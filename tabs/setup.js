/*global $,chrome,FC,helper,mspHelper,MIXER_CONFIG,BF_CONFIG*/
////'use strict';
//global $;

TABS.setup = {
    yaw_fix: 0.0
};

window.$platformSelect  = window.$platformSelect??{};
$platformSelect = window.$platformSelect;

window.$hasFlapsWrapper = $('#has-flaps-wrapper');
$hasFlapsWrapper = window.$hasFlapsWrapper;

window.$mixerPreset  = window.$mixerPreset??{};
$mixerPreset = window.$mixerPreset;


TABS.setup.initialize = function (callback) {
    var self = this;

    if (GUI.active_tab != 'setup') {
        GUI.active_tab = 'setup';
        //googleAnalytics.sendAppView('Setup');
    }

    // var loadChainer = new MSPChainerClass();

    // var loadChain = [
    //     mspHelper.loadBfConfig,
    //     mspHelper.queryFcStatus,
    //     mspHelper.loadMixerConfig
    // ];

    // loadChain.push(mspHelper.loadMiscV2);
    // loadChainer.setChain(loadChain);
    // loadChainer.setExitPoint(load_html);
    // loadChainer.execute();
    load_html();

    function load_html() {
        GUI.load("./tabs/setup.html", process_html);
    }

    function process_html() {
        // translate to user-selected language
        localize();

        if (!FC.isMotorOutputEnabled()) {
            GUI_control.prototype.log("<span style='color: red; font-weight: bolder'><strong>" + chrome.i18n.getMessage("logPwmOutputDisabled") + "</strong></span>");
        }



        window.$platformSelect = $('#platform-type');
        window.$mixerPreset = $('#mixer-preset');
        buzz_veh_sels();


        // initialize 3D
        self.initialize3D(); // buzz

		// set roll in interactive block
        $('span.roll').text(chrome.i18n.getMessage('initialSetupAttitude', [0]));
		// set pitch in interactive block
        $('span.pitch').text(chrome.i18n.getMessage('initialSetupAttitude', [0]));
        // set heading in interactive block
        $('span.heading').text(chrome.i18n.getMessage('initialSetupAttitude', [0]));


        // check if we have magnetometer
        if (!bit_check(CONFIG.activeSensors, 2)) {
            $('a.calibrateMag').addClass('disabled');
            $('default_btn').addClass('disabled');
        }

        self.initializeInstruments();

        // button on 'setup' tab
        $('a.resetSettings').click(function () {
            if (confirm(chrome.i18n.getMessage('confirm_reset_settings'))) {
                MSP.send_message(MSPCodes.MSP_RESET_CONF, false, false, function () {
                    GUI.log(chrome.i18n.getMessage('initialSetupSettingsRestored'));
    
                    GUI.tab_switch_cleanup(function () {
                        TABS.setup.initialize();
                    });
                });
            }
        });

        //like resetSettings but on 'params' tab
        //refreshParams
        //saveParams
        //filesaveParams
        //fileloadParams

        // display current yaw fix value (important during tab re-initialization)
        $('div#interactive_block > a.reset').text(chrome.i18n.getMessage('initialSetupButtonResetZaxisValue', [self.yaw_fix]));

        // reset yaw button hook
        $('div#interactive_block > a.reset').click(function () {
            self.yaw_fix = SENSOR_DATA.kinematics[2] * - 1.0;
            $(this).text(chrome.i18n.getMessage('initialSetupButtonResetZaxisValue', [self.yaw_fix]));

            console.log('YAW reset to 0 deg, fix: ' + self.yaw_fix + ' deg');
        });

        // cached elements
        var bat_voltage_e = $('.bat-voltage'),
            bat_percent_e = $('.bat-percent'),
            bat_remaining_e = $('.bat-remain-cap'),
            bat_cells_e = $('.bat-cells'),
            bat_thresh_e = $('.bat-thresh'),
            bat_full_e = $('.bat-full'),
            bat_mah_drawn_e = $('.bat-mah-drawn'),
            bat_wh_drawn_e = $('.bat-mwh-drawn'),
            bat_current_draw_e = $('.bat-current-draw'),
            bat_power_draw_e = $('.bat-power-draw'),
            rssi_e = $('.rssi'),
            gpsFix_e = $('.gpsFixType'),
            gpsSats_e = $('.gpsSats'),
            gpsLat_e = $('.gpsLat'),
            gpsLon_e = $('.gpsLon'),
            roll_e = $('dd.roll'),
            pitch_e = $('dd.pitch'),
            heading_e = $('dd.heading');

        function get_slow_data() {
            // buz hack
            //CONFIG.activeSensors = 
            if (have_sensor(CONFIG.activeSensors, 'gps')) {

                /*
                 * Enable balancer
                 */
                if (helper.mspQueue.shouldDrop()) {
                    return;
                }

               // MSP.send_message(MSPCodes.MSP_RAW_GPS, false, false, function () {
                    var gpsFixType = chrome.i18n.getMessage('gpsFixNone');
                    if (GPS_DATA.fix >= 2)
                        gpsFixType = chrome.i18n.getMessage('gpsFix3D');
                    else if (GPS_DATA.fix >= 1)
                        gpsFixType = chrome.i18n.getMessage('gpsFix2D');
                    gpsFix_e.html(gpsFixType);
                    gpsSats_e.text(GPS_DATA.numSat);
                    gpsLat_e.text((GPS_DATA.lat / 10000000).toFixed(4) + ' deg');
                    gpsLon_e.text((GPS_DATA.lon / 10000000).toFixed(4) + ' deg');
               // });
            }
        }

        function get_fast_data() {

            /*
             * Enable balancer
             */
            if (helper.mspQueue.shouldDrop()) {
                return;
            }

           // MSP.send_message(MSPCodes.MSP_ATTITUDE, false, false, function () {
	            roll_e.text(chrome.i18n.getMessage('initialSetupAttitude', [SENSOR_DATA.kinematics[0]]));
	            pitch_e.text(chrome.i18n.getMessage('initialSetupAttitude', [SENSOR_DATA.kinematics[1]]));
                heading_e.text(chrome.i18n.getMessage('initialSetupAttitude', [SENSOR_DATA.kinematics[2]]));
                self.render3D();
                self.updateInstruments();
            //});
        }

        helper.mspBalancedInterval.add('setup_data_pull_fast', 40, 1, get_fast_data);
        helper.mspBalancedInterval.add('setup_data_pull_slow', 250, 1, get_slow_data);

        helper.interval.add('gui_analog_update', function () {
            bat_cells_e.text(chrome.i18n.getMessage('initialSetupBatteryDetectedCellsValue', [ANALOG.cell_count]));
            bat_voltage_e.text(chrome.i18n.getMessage('initialSetupBatteryVoltageValue', [ANALOG.voltage]));
            var remaining_capacity_wh_decimals = ANALOG.battery_remaining_capacity.toString().length < 5 ? 3 : (7 - ANALOG.battery_remaining_capacity.toString().length);
            var remaining_capacity_value = MISC.battery_capacity_unit == 'mAh' ? ANALOG.battery_remaining_capacity : (ANALOG.battery_remaining_capacity / 1000).toFixed(remaining_capacity_wh_decimals < 0 ? 0 : remaining_capacity_wh_decimals);
            var remaining_capacity_unit = MISC.battery_capacity_unit == 'mAh' ? 'mAh' : 'Wh';
            bat_remaining_e.text(chrome.i18n.getMessage('initialSetupBatteryRemainingCapacityValue', ((MISC.battery_capacity > 0) && ANALOG.battery_full_when_plugged_in) ? [remaining_capacity_value, remaining_capacity_unit] : ['NA', '']));
            bat_percent_e.text(chrome.i18n.getMessage('initialSetupBatteryPercentageValue', [ANALOG.battery_percentage]));
            bat_full_e.text(chrome.i18n.getMessage('initialSetupBatteryFullValue', [ANALOG.battery_full_when_plugged_in]));
            bat_thresh_e.text(chrome.i18n.getMessage('initialSetupBatteryThresholdsValue', [ANALOG.use_capacity_thresholds]));
            bat_mah_drawn_e.text(chrome.i18n.getMessage('initialSetupBatteryMahValue', [ANALOG.mAhdrawn]));
            var capacity_drawn_decimals = ANALOG.mWhdrawn.toString().length < 5 ? 3 : (7 - ANALOG.mWhdrawn.toString().length);
            bat_wh_drawn_e.text(chrome.i18n.getMessage('initialSetup_Wh_drawnValue', [(ANALOG.mWhdrawn / 1000).toFixed(capacity_drawn_decimals < 0 ? 0 : capacity_drawn_decimals)]));
            bat_current_draw_e.text(chrome.i18n.getMessage('initialSetupCurrentDrawValue', [ANALOG.amperage.toFixed(2)]));
            bat_power_draw_e.text(chrome.i18n.getMessage('initialSetupPowerDrawValue', [ANALOG.power.toFixed(2)]));
            rssi_e.text(chrome.i18n.getMessage('initialSetupRSSIValue', [((ANALOG.rssi / 1023) * 100).toFixed(0)]));
        }, 100, true);

        function updateArminFailure() {
            var flagNames = FC.getArmingFlags();
            for (var bit in flagNames) {
                if (flagNames.hasOwnProperty(bit)) {
                    if (bit_check(CONFIG.armingFlags, bit)) {
                        $('#reason-' + flagNames[bit]).html(chrome.i18n.getMessage('armingCheckFail'));
                    }
                    else {
                        $('#reason-' + flagNames[bit]).html(chrome.i18n.getMessage('armingCheckPass'));
                    }
                }
            }
        }

        /*
         * 1fps update rate will be fully enough
         */
        helper.interval.add('updateArminFailure', updateArminFailure, 500, true);

        GUI.content_ready(callback);
    }
};

TABS.setup.initializeInstruments = function() {
    var options = {size:90, showBox : true, img_directory: 'images/flightindicators/'};
    var attitude = $.flightIndicator('#attitude', 'attitude', options);
    var heading = $.flightIndicator('#heading', 'heading', options);

    this.updateInstruments = function() {
        attitude.setRoll(SENSOR_DATA.kinematics[0]);
        attitude.setPitch(SENSOR_DATA.kinematics[1]);
        heading.setHeading(SENSOR_DATA.kinematics[2]);
    };
};

TABS.setup.initialize3D = function () {
    var self = this,
        loader,
        canvas,
        wrapper,
        renderer,
        camera,
        scene,
        light,
        light2,
        modelWrapper,
        model,
        model_file,
        useWebGlRenderer = false;

    canvas = $('.model-and-info #canvas');
    wrapper = $('.model-and-info #canvas_wrapper');

    // webgl capability detector
    // it would seem the webgl "enabling" through advanced settings will be ignored in the future
    // and webgl will be supported if gpu supports it by default (canary 40.0.2175.0), keep an eye on this one
    var detector_canvas = document.createElement('canvas');
    if (window.WebGLRenderingContext && (detector_canvas.getContext('webgl') || detector_canvas.getContext('experimental-webgl'))) {
        renderer = new THREE.WebGLRenderer({canvas: canvas.get(0), alpha: true, antialias: true});
        useWebGlRenderer = true;
    } else {
        renderer = new THREE.CanvasRenderer({canvas: canvas.get(0), alpha: true});
    }
    // initialize render size for current canvas size
    renderer.setSize(wrapper.width()*2, wrapper.height()*2);


    // modelWrapper adds an extra axis of rotation to avoid gimbal lock with the euler angles
    modelWrapper = new THREE.Object3D();

    var veh_type =  platformList[MIXER_CONFIG.platformType].name;
    //var mix_type =  mixerList[MIXER_CONFIG.platformType];

    //if veh_type == "Multirotor" } {}

    // load the model including materials
    //if (useWebGlRenderer) {
        //if (MIXER_CONFIG.appliedMixerPreset === -1) {
        //    model_file = 'custom';
            GUI_control.prototype.log("<span style='color: red; font-weight: bolder'><strong>" + chrome.i18n.getMessage("mixerNotConfigured") + "</strong></span>");
       // } else {
            model_file = helper.mixer.getById(MIXER_CONFIG.appliedMixerPreset).model; // buzz 3d
       // }
   // } else {
    //    model_file = 'fallback'
    //}

    // Temporary workaround for 'custom' model until akfreak's custom model is merged.
    if (model_file == 'custom')   model_file = 'fallback';
    if (model_file == undefined ) model_file = 'fallback';
    

    // setup scene
    scene = new THREE.Scene();

    //loader = new THREE.LegacyJSONLoader();
    //loader.load('./resources/models/' + model_file + '.json', function (geometry, materials) { // buzz 3d
        //var modelMaterial = new THREE.MeshFaceMaterial(materials);
        //model = new THREE.Mesh(geometry, modelMaterial);

        //model.scale.set(15, 15, 15);

        //modelWrapper.add(model);
        //scene.add(modelWrapper);
   // });

    //buzz 3d gltf loader , as GLTF is a newer format thats supported going forward in newer Three.js vrsions.
    // the 'key' here is from model.js mixerList[] that defines aircraft/subtypes/servos relationships
    var _3d_models = {
        // plane-like-things
        'spitfire'  : {'file' :'resources/models/spitfire-1.2m.gltf', 'scaling':5, 'sceneoffset':0},
        'flying_wing' : {'file' :'resources/models/flying_wing.gltf', 'scaling':0.8, 'sceneoffset':0},
        'talon' : {'file' :'resources/models/mini-talon-1m.bix-tex.gltf', 'scaling':8, 'sceneoffset':0},
        'bixler' : {'file' :'resources/models/bixler-1m.gltf', 'scaling':5, 'sceneoffset':0},
        'griffin' : {'file' :'resources/models/griffin-1m.black.gltf', 'scaling':5, 'sceneoffset':0},
        'cub' : {'file' :'resources/models/piper-supercub.fixed.tex.gltf', 'scaling':5, 'sceneoffset':0},
        'alti' : {'file' :'resources/models/alti-transition3.propped.gltf', 'scaling':5, 'sceneoffset':0},
        // copter-like-things
        'tricopter' : {'file' :'resources/models/tricopter.gltf', 'scaling':1, 'sceneoffset':0},
        //
        'quad_x' : {'file' :'resources/models/quad_x.gltf', 'scaling':0.8, 'sceneoffset':0},
        //'quad_+' : {'file' :'resources/models/quad_+.gltf', 'scaling':0.6, 'sceneoffset':0},
        //
        'hex_plus' : {'file' :'resources/models/hex_plus.gltf', 'scaling':0.6, 'sceneoffset':0},
        //'hex_+' : {'file' :'resources/models/hex_+.gltf', 'scaling':0.8, 'sceneoffset':0},
        //
        'y4' : {'file' :'resources/models/y4.gltf', 'scaling':0.6, 'sceneoffset':0},
        'y6' : {'file' :'resources/models/y6.gltf', 'scaling':0.6, 'sceneoffset':0},
        //
        // neither:
        'fallback' : {'file' :'resources/models/fallback.redo.gltf', 'scaling':5, 'sceneoffset':0},
    };

    var modelname = model_file; // modelname=idx into the above short 3d list; model_file = the "asked-for" file, that might not exist.
    if ( _3d_models[model_file] == undefined ){ // use fallback block for stuff we dont have
        modelname = 'fallback'; // 
    }

    // Instantiate another loader
    //const 
    loader2 = new THREE.GLTFLoader();
    //var modelname = 'alti';
    var fname = _3d_models[modelname].file;
    var scaler = _3d_models[modelname].scaling;
    var sceneoffset = _3d_models[modelname].sceneoffset;
    loader2.load( 
        fname,
     function ( gltf ) {  // called when the resource is loaded
    
    
            // pick model object as the first child in the scene, hopefull.y
            model = gltf.scene.children[sceneoffset];// first child in scene?

            //model.scale.set(1, 1, 1);

            model.scale.x = model.scale.x *scaler; 
            model.scale.y = model.scale.y *scaler; 
            model.scale.z = model.scale.z *scaler;

            modelWrapper.add(model);
            scene.add(modelWrapper);

            // //scene.add( gltf.scene );
            // gltf.animations; // Array<THREE.AnimationClip>
            // gltf.scene; // THREE.Group
            // gltf.scenes; // Array<THREE.Group>
            // gltf.cameras; // Array<THREE.Camera>
            // gltf.asset; // Object

    
        },
        // called while loading is progressing
        function ( xhr ) {
    
            console.log( ( xhr.loaded / xhr.total * 100 ) + '% loaded' );
    
        },
        // called when loading has errors
        function ( error ) {
    
            console.log( 'An error happened' );
    
        }
    );

    //stationary camera
    camera = new THREE.PerspectiveCamera(50, wrapper.width() / wrapper.height(), 1, 10000);

    //some light
    light = new THREE.AmbientLight(0x606060);
    light2 = new THREE.DirectionalLight(new THREE.Color(1, 1, 1), 1.5);
    light2.position.set(0, 1, 0);

    //move camera toward/away from the model
    camera.position.z = 8;  // 8 is ok for models around 1m in size.

    //add camera, model, light to the foreground scene
   scene.add(light);
   scene.add(light2);
   scene.add(camera);
   //scene.add(modelWrapper);


    //----------------

    this.render3D = function () {
        if (!model) {
            return;
        }

        // compute the changes
        model.rotation.x = (SENSOR_DATA.kinematics[1] * -1.0) * 0.017453292519943295;
        modelWrapper.rotation.y = ((SENSOR_DATA.kinematics[2] * -1.0) - self.yaw_fix) * 0.017453292519943295;
        model.rotation.z = (SENSOR_DATA.kinematics[0] * -1.0) * 0.017453292519943295;

        // draw
        renderer.render(scene, camera);
    };

    // handle canvas resize
    this.resize3D = function () {
        renderer.setSize(wrapper.width()*2, wrapper.height()*2);
        camera.aspect = wrapper.width() / wrapper.height();
        camera.updateProjectionMatrix();

        self.render3D();
    };

    $(window).on('resize', this.resize3D);
};

TABS.setup.cleanup = function (callback) {
    $(window).off('resize', this.resize3D);

    if (callback) callback();
};
