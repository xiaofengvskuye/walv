
var vm = null;

//The Python code to Initialize the environment
var lvEnv = [
    "import ujson",
    "import lvgl as lv",
    "lv.init()",
    "import SDL",
    "SDL.init()",
    /* Register SDL display driver. */
    "disp_buf1 = lv.disp_buf_t()",
    "buf1_1 = bytes(960*10)",
    "lv.disp_buf_init(disp_buf1,buf1_1, None, len(buf1_1)//4)",
    "disp_drv = lv.disp_drv_t()",
    "lv.disp_drv_init(disp_drv)",
    "disp_drv.buffer = disp_buf1",
    "disp_drv.flush_cb = SDL.monitor_flush",
    "disp_drv.hor_res = 480",
    "disp_drv.ver_res = 320",
    "lv.disp_drv_register(disp_drv)",
    /*Regsiter SDL mouse driver*/
    "indev_drv = lv.indev_drv_t()",
    "lv.indev_drv_init(indev_drv)",
    "indev_drv.type = lv.INDEV_TYPE.POINTER;",
    "indev_drv.read_cb = SDL.mouse_read;",
    "lv.indev_drv_register(indev_drv);",
    /* Create a screen with a button and a label */
    "scr = lv.obj()",
    /* Load the screen */
    "lv.scr_load(scr)",
    "baseAttr = dir(lv.obj)"
];

/* Define special function for python*/
var defFun = [
    //Get and send JSON format text
    "def getobjattr(obj, id):",
    "    d={}",
    "    d['id']=id",
    "    for i in dir(obj):",
    "        if 'get_' in i:",
    "            try:",
    "                ret = eval(id + '.' + i + '()')",
    "                if isinstance(ret, (int,float,str,bool)):",
    "                    d[i] = ret",
    "            except:",
    "                pass",
    "    print('\x06'+ujson.dumps(d)+'\x15')",
    //Determine what event is: 
    //Test b: b.set_event_cb(lambda obj=None, event=-1,name='b',real_obj=b:EventCB(real_obj,name,event))
    "def EventCB(obj, id, event):",
    "    if event == lv.EVENT.DRAG_END:",
    "        getobjattr(obj, id)"
];


window.onload = function() {   
    vm = new Vue({
        el: "#walv",
        data: {
            buffer: [],
            str_json: "",
            mask: false,
            currJSON: {},
            Widget: []
        },
        watch: {
            str_json: function(val) {
                try {
                    currJSON = JSON.parse(this.str_json);
                    console.log(currJSON);                    
                } catch (error) {
                    console.log(error);
                }
            }
        },
        methods: {
            handle_stdout: function(text){
                if(text == '\x15')      //End: '\x15'
                {
                    this.mask = false;
                    this.str_json = this.buffer.join('');
                }                
                if(this.mask)
                {
                    this.buffer.push(text);
                    text = "";
                }        
                if(text == '\x06')      //Begin: '\x06'
                {     
                    this.mask = true;
                }

                if(text == '\n')
                {
                    this.buffer.splice(0, this.buffer.length);
                }
                return text;          
            }
        }
   
    });

    mpylv_init(vm);

    /* Initialize the ace editor */
    editor = ace.edit("code-editor");
    editor.getSession().setUseWrapMode(true);
    editor.setAutoScrollEditorIntoView(true);
    var PythonMode = ace.require("ace/mode/python").Mode;
    editor.session.setMode(new PythonMode());
    editor.setOptions({
    maxLines: "350px" });
    document.title = "WALV"
}

function mpylv_init(vm) {
    


    Module.canvas = document.getElementById("canvas");

    /* Bind mp_js_stdout */
    mp_js_stdout = document.getElementById('mp_js_stdout');
    mp_js_stdout.value = "";

    /* Initialize the xtermjs */
    Terminal.applyAddon(fit);
    let term = new Terminal({
      cursorBlink: true,
    //   theme: {
    //     background: '#fdf6e3'
    //   }
    });
    term.open(document.getElementById("mpy_repl"), true);
    term.fit();
    term.write('Hello from \x1B[1;3;31mWALV\x1B[0m');

    /*Initialize MicroPython itself*/
    mp_js_init(8 * 1024 * 1024); 

    /*Setup printing event handler*/
    mp_js_stdout.addEventListener('print', function(e) {
        // console.log(e.data);
        term.write(vm.handle_stdout(e.data));
    }, false);

    /*Setup key input handler */
    term.on('data', function(key, e) {
        for(var i = 0; i < key.length; i++) {
            mp_js_process_char(key.charCodeAt(i));
        }
    });

    /* Run init script */
    for(var i = 0;i < lvEnv.length;i++){
        mp_js_do_str(lvEnv[i]);
    }
    /* Add function getobjattr() & EventCB() */
    mp_js_do_str(defFun.join('\n'));

    /*Setup lv_task_handler loop*/
    var the_mp_handle_pending = Module.cwrap('mp_handle_pending', null);
    function handle_pending() {
        the_mp_handle_pending();
        setTimeout(handle_pending, 10); // should call lv_task_handler() 
    }
    
    /*Initialize the REPL.*/
    mp_js_init_repl();

    /*Start the main loop, asynchronously.*/
    handle_pending();
}