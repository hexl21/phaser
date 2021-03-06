/**
 * @author       Richard Davey <rich@photonstorm.com>
 * @copyright    2018 Photon Storm Ltd.
 * @license      {@link https://github.com/photonstorm/phaser/blob/master/license.txt|MIT License}
 */

var Camera = require('./Camera');
var Class = require('../../utils/Class');
var GetFastValue = require('../../utils/object/GetFastValue');
var PluginCache = require('../../plugins/PluginCache');
var RectangleContains = require('../../geom/rectangle/Contains');

/**
 * @typedef {object} InputJSONCameraObject
 *
 * @property {string} [name=''] - The name of the Camera.
 * @property {integer} [x=0] - The horizontal position of the Camera viewport.
 * @property {integer} [y=0] - The vertical position of the Camera viewport.
 * @property {integer} [width] - The width of the Camera viewport.
 * @property {integer} [height] - The height of the Camera viewport.
 * @property {number} [zoom=1] - The default zoom level of the Camera.
 * @property {number} [rotation=0] - The rotation of the Camera, in radians.
 * @property {boolean} [roundPixels=false] - Should the Camera round pixels before rendering?
 * @property {number} [scrollX=0] - The horizontal scroll position of the Camera.
 * @property {number} [scrollY=0] - The vertical scroll position of the Camera.
 * @property {(false|string)} [backgroundColor=false] - A CSS color string controlling the Camera background color.
 * @property {?object} [bounds] - Defines the Camera bounds.
 * @property {number} [bounds.x=0] - The top-left extent of the Camera bounds.
 * @property {number} [bounds.y=0] - The top-left extent of the Camera bounds.
 * @property {number} [bounds.width] - The width of the Camera bounds.
 * @property {number} [bounds.height] - The height of the Camera bounds.
 */

/**
 * @classdesc
 * The Camera Manager is a plugin that belongs to a Scene and is responsible for managing all of the Scene Cameras.
 * 
 * By default you can access the Camera Manager from within a Scene using `this.cameras`, although this can be changed
 * in your game config.
 * 
 * The Camera Manager can manage up to 31 unique Cameras. You can use the properties `camera1` through to `camera10`
 * for quick and easy access to the first 10 cameras you define.
 * 
 * Create new Cameras using the `add` method. Or extend the Camera class with your own addition code and then add
 * the new Camera in using the `addExisting` method.
 * 
 * Cameras provide a view into your game world, and can be positioned, rotated, zoomed and scrolled accordingly.
 *
 * A Camera consists of two elements: The viewport and the scroll values.
 *
 * The viewport is the physical position and size of the Camera within your game. Cameras, by default, are
 * created the same size as your game, but their position and size can be set to anything. This means if you
 * wanted to create a camera that was 320x200 in size, positioned in the bottom-right corner of your game,
 * you'd adjust the viewport to do that (using methods like `setViewport` and `setSize`).
 *
 * If you wish to change where the Camera is looking in your game, then you scroll it. You can do this
 * via the properties `scrollX` and `scrollY` or the method `setScroll`. Scrolling has no impact on the
 * viewport, and changing the viewport has no impact on the scrolling.
 *
 * By default a Camera will render all Game Objects it can see. You can change this using the `ignore` method,
 * allowing you to filter Game Objects out on a per-Camera basis.
 *
 * A Camera also has built-in special effects including Fade, Flash and Camera Shake.
 *
 * @class CameraManager
 * @memberOf Phaser.Cameras.Scene2D
 * @constructor
 * @since 3.0.0
 *
 * @param {Phaser.Scene} scene - The Scene that owns the Camera Manager plugin.
 */
var CameraManager = new Class({

    initialize:

    function CameraManager (scene)
    {
        /**
         * The Scene that owns the Camera Manager plugin.
         *
         * @name Phaser.Cameras.Scene2D.CameraManager#scene
         * @type {Phaser.Scene}
         * @since 3.0.0
         */
        this.scene = scene;

        /**
         * A reference to the Scene.Systems handler for the Scene that owns the Camera Manager.
         *
         * @name Phaser.Cameras.Scene2D.CameraManager#systems
         * @type {Phaser.Scenes.Systems}
         * @since 3.0.0
         */
        this.systems = scene.sys;

        /**
         * The ID that will be assigned to the next Camera that is created.
         * This is a bitmask value, meaning only up to 31 cameras can be created in total.
         *
         * @name Phaser.Cameras.Scene2D.CameraManager#nextID
         * @type {integer}
         * @default 1
         * @readOnly
         * @since 3.0.0
         */
        this.nextID = 1;

        /**
         * An Array of the Camera objects being managed by this Camera Manager.
         * The Cameras are updated and rendered in the same order in which they appear in this array.
         * Do not directly add or remove entries to this array. However, you can move the contents
         * around the array should you wish to adjust the display order.
         *
         * @name Phaser.Cameras.Scene2D.CameraManager#cameras
         * @type {Phaser.Cameras.Scene2D.Camera[]}
         * @since 3.0.0
         */
        this.cameras = [];

        /**
         * A handy reference to the 'main' camera. By default this is the first Camera the
         * Camera Manager creates. You can also set it directly, or use the `makeMain` argument
         * in the `add` and `addExisting` methods. It allows you to access it from your game:
         * 
         * ```javascript
         * var cam = this.cameras.main;
         * ```
         * 
         * Also see the properties `camera1`, `camera2` and so on.
         *
         * @name Phaser.Cameras.Scene2D.CameraManager#main
         * @type {Phaser.Cameras.Scene2D.Camera}
         * @since 3.0.0
         */
        this.main;

        /**
         * This scale affects all cameras. It's used by the Scale Manager.
         *
         * @name Phaser.Cameras.Scene2D.CameraManager#baseScale
         * @type {number}
         * @since 3.0.0
         */
        this.baseScale = 1;

        scene.sys.events.once('boot', this.boot, this);
        scene.sys.events.on('start', this.start, this);
    },

    /**
     * This method is called automatically, only once, when the Scene is first created.
     * Do not invoke it directly.
     *
     * @method Phaser.Cameras.Scene2D.CameraManager#boot
     * @private
     * @since 3.5.1
     */
    boot: function ()
    {
        var sys = this.systems;

        if (sys.settings.cameras)
        {
            //  We have cameras to create
            this.fromJSON(sys.settings.cameras);
        }
        else
        {
            //  Make one
            this.add();
        }

        this.main = this.cameras[0];

        this.systems.events.once('destroy', this.destroy, this);
    },

    /**
     * This method is called automatically by the Scene when it is starting up.
     * It is responsible for creating local systems, properties and listening for Scene events.
     * Do not invoke it directly.
     *
     * @method Phaser.Cameras.Scene2D.CameraManager#start
     * @private
     * @since 3.5.0
     */
    start: function ()
    {
        if (!this.main)
        {
            this.boot();
        }

        var eventEmitter = this.systems.events;

        eventEmitter.on('update', this.update, this);
        eventEmitter.once('shutdown', this.shutdown, this);
    },

    /**
     * Adds a new Camera into the Camera Manager. The Camera Manager can support up to 31 different Cameras.
     * 
     * Each Camera has its own viewport, which controls the size of the Camera and its position within the canvas.
     * 
     * Use the `Camera.scrollX` and `Camera.scrollY` properties to change where the Camera is looking, or the
     * Camera methods such as `centerOn`. Cameras also have built in special effects, such as fade, flash, shake,
     * pan and zoom.
     * 
     * By default Cameras are transparent and will render anything that they can see based on their `scrollX`
     * and `scrollY` values. Game Objects can be set to be ignored by a Camera by using the `Camera.ignore` method.
     * 
     * See the Camera class documentation for more details.
     *
     * @method Phaser.Cameras.Scene2D.CameraManager#add
     * @since 3.0.0
     *
     * @param {integer} [x=0] - The horizontal position of the Camera viewport.
     * @param {integer} [y=0] - The vertical position of the Camera viewport.
     * @param {integer} [width] - The width of the Camera viewport. If not given it'll be the game config size.
     * @param {integer} [height] - The height of the Camera viewport. If not given it'll be the game config size.
     * @param {boolean} [makeMain=false] - Set this Camera as being the 'main' camera. This just makes the property `main` a reference to it.
     * @param {string} [name=''] - The name of the Camera.
     *
     * @return {Phaser.Cameras.Scene2D.Camera} The newly created Camera.
     */
    add: function (x, y, width, height, makeMain, name)
    {
        if (x === undefined) { x = 0; }
        if (y === undefined) { y = 0; }
        if (width === undefined) { width = this.scene.sys.game.config.width; }
        if (height === undefined) { height = this.scene.sys.game.config.height; }
        if (makeMain === undefined) { makeMain = false; }
        if (name === undefined) { name = ''; }

        var camera = new Camera(x, y, width, height);

        camera.setName(name);
        camera.setScene(this.scene);

        this.cameras.push(camera);

        if (makeMain)
        {
            this.main = camera;
        }

        camera.id = this.nextID;

        this.nextID = this.nextID << 1;

        return camera;
    },

    /**
     * Adds an existing Camera into the Camera Manager.
     * 
     * The Camera should either be a `Phaser.Cameras.Scene2D.Camera` instance, or a class that extends from it.
     * 
     * The Camera will be assigned an ID, which is used for Game Object exclusion and then added to the
     * manager. As long as it doesn't already exist in the manager it will be added then returned.
     * 
     * If this method returns `null` then the Camera already exists in this Camera Manager.
     *
     * @method Phaser.Cameras.Scene2D.CameraManager#addExisting
     * @since 3.0.0
     *
     * @param {Phaser.Cameras.Scene2D.Camera} camera - The Camera to be added to the Camera Manager.
     * @param {boolean} [makeMain=false] - Set this Camera as being the 'main' camera. This just makes the property `main` a reference to it.
     *
     * @return {?Phaser.Cameras.Scene2D.Camera} The Camera that was added to the Camera Manager, or `null` if it couldn't be added.
     */
    addExisting: function (camera, makeMain)
    {
        if (makeMain === undefined) { makeMain = false; }

        var index = this.cameras.indexOf(camera);

        if (index === -1)
        {
            this.cameras.push(camera);

            camera.id = this.nextID;

            this.nextID = this.nextID << 1;

            if (makeMain)
            {
                this.main = camera;
            }
    
            return camera;
        }

        return null;
    },

    /**
     * Populates this Camera Manager based on the given configuration object, or an array of config objects.
     * 
     * See the `InputJSONCameraObject` documentation for details of the object structure.
     *
     * @method Phaser.Cameras.Scene2D.CameraManager#fromJSON
     * @since 3.0.0
     *
     * @param {(InputJSONCameraObject|InputJSONCameraObject[])} config - A Camera configuration object, or an array of them, to be added to this Camera Manager.
     *
     * @return {Phaser.Cameras.Scene2D.CameraManager} This Camera Manager instance.
     */
    fromJSON: function (config)
    {
        if (!Array.isArray(config))
        {
            config = [ config ];
        }

        var gameWidth = this.scene.sys.game.config.width;
        var gameHeight = this.scene.sys.game.config.height;

        for (var i = 0; i < config.length; i++)
        {
            var cameraConfig = config[i];

            var x = GetFastValue(cameraConfig, 'x', 0);
            var y = GetFastValue(cameraConfig, 'y', 0);
            var width = GetFastValue(cameraConfig, 'width', gameWidth);
            var height = GetFastValue(cameraConfig, 'height', gameHeight);

            var camera = this.add(x, y, width, height);

            //  Direct properties
            camera.name = GetFastValue(cameraConfig, 'name', '');
            camera.zoom = GetFastValue(cameraConfig, 'zoom', 1);
            camera.rotation = GetFastValue(cameraConfig, 'rotation', 0);
            camera.scrollX = GetFastValue(cameraConfig, 'scrollX', 0);
            camera.scrollY = GetFastValue(cameraConfig, 'scrollY', 0);
            camera.roundPixels = GetFastValue(cameraConfig, 'roundPixels', false);
            camera.visible = GetFastValue(cameraConfig, 'visible', true);

            // Background Color

            var backgroundColor = GetFastValue(cameraConfig, 'backgroundColor', false);

            if (backgroundColor)
            {
                camera.setBackgroundColor(backgroundColor);
            }

            //  Bounds

            var boundsConfig = GetFastValue(cameraConfig, 'bounds', null);

            if (boundsConfig)
            {
                var bx = GetFastValue(boundsConfig, 'x', 0);
                var by = GetFastValue(boundsConfig, 'y', 0);
                var bwidth = GetFastValue(boundsConfig, 'width', gameWidth);
                var bheight = GetFastValue(boundsConfig, 'height', gameHeight);

                camera.setBounds(bx, by, bwidth, bheight);
            }
        }

        return this;
    },

    /**
     * Gets a Camera based on its name.
     * 
     * Camera names are optional and don't have to be set, so this method is only of any use if you
     * have given your Cameras unique names.
     *
     * @method Phaser.Cameras.Scene2D.CameraManager#getCamera
     * @since 3.0.0
     *
     * @param {string} name - The name of the Camera.
     *
     * @return {?Phaser.Cameras.Scene2D.Camera} The first Camera with a name matching the given string, otherwise `null`.
     */
    getCamera: function (name)
    {
        var cameras = this.cameras;

        for (var i = 0; i < cameras.length; i++)
        {
            if (cameras[i].name === name)
            {
                return cameras[i];
            }
        }

        return null;
    },

    /**
     * Returns an array of all cameras below the given Pointer.
     * 
     * The first camera in the array is the top-most camera in the camera list.
     *
     * @method Phaser.Cameras.Scene2D.CameraManager#getCamerasBelowPointer
     * @since 3.10.0
     *
     * @param {Phaser.Input.Pointer} pointer - The Pointer to check against.
     *
     * @return {Phaser.Cameras.Scene2D.Camera[]} An array of cameras below the Pointer.
     */
    getCamerasBelowPointer: function (pointer)
    {
        var cameras = this.cameras;

        var x = pointer.x;
        var y = pointer.y;

        var output = [];

        for (var i = 0; i < cameras.length; i++)
        {
            var camera = cameras[i];

            if (camera.visible && camera.inputEnabled && RectangleContains(camera, x, y))
            {
                //  So the top-most camera is at the top of the search array
                output.unshift(camera);
            }
        }

        return output;
    },

    /**
     * Removes the given Camera from this Camera Manager.
     * 
     * If found in the Camera Manager it will be immediately removed from the local cameras array.
     * If also currently the 'main' camera, 'main' will be reset to be camera 0.
     * 
     * The removed Camera is not destroyed. If you also wish to destroy the Camera, you should call
     * `Camera.destroy` on it, so that it clears all references to the Camera Manager.
     *
     * @method Phaser.Cameras.Scene2D.CameraManager#remove
     * @since 3.0.0
     *
     * @param {Phaser.Cameras.Scene2D.Camera} camera - The Camera to be removed from this Camera Manager.
     */
    remove: function (camera)
    {
        var cameraIndex = this.cameras.indexOf(camera);

        if (cameraIndex >= 0 && this.cameras.length > 1)
        {
            this.cameras.splice(cameraIndex, 1);

            if (this.main === camera)
            {
                this.main = this.cameras[0];
            }
        }
    },

    /**
     * The internal render method. This is called automatically by the Scene and should not be invoked directly.
     * 
     * It will iterate through all local cameras and render them in turn, as long as they're visible and have
     * an alpha level > 0.
     *
     * @method Phaser.Cameras.Scene2D.CameraManager#render
     * @protected
     * @since 3.0.0
     *
     * @param {(Phaser.Renderer.Canvas.CanvasRenderer|Phaser.Renderer.WebGL.WebGLRenderer)} renderer - The Renderer that will render the children to this camera.
     * @param {Phaser.GameObjects.GameObject[]} children - An array of renderable Game Objects.
     * @param {number} interpolation - Interpolation value. Reserved for future use.
     */
    render: function (renderer, children, interpolation)
    {
        var scene = this.scene;
        var cameras = this.cameras;
        var baseScale = this.baseScale;
        var resolution = renderer.config.resolution;

        for (var i = 0; i < this.cameras.length; i++)
        {
            var camera = cameras[i];

            if (camera.visible && camera.alpha > 0)
            {
                camera.preRender(baseScale, resolution);

                renderer.render(scene, children, interpolation, camera);
            }
        }
    },

    /**
     * Resets this Camera Manager.
     * 
     * This will iterate through all current Cameras, destroying them all, then it will reset the
     * cameras array, reset the ID counter and create 1 new single camera using the default values.
     *
     * @method Phaser.Cameras.Scene2D.CameraManager#resetAll
     * @since 3.0.0
     *
     * @return {Phaser.Cameras.Scene2D.Camera} The freshly created main Camera.
     */
    resetAll: function ()
    {
        for (var i = 0; i < this.cameras.length; i++)
        {
            this.cameras[i].destroy();
        }

        this.cameras = [];

        this.nextID = 1;

        this.main = this.add();

        return this.main;
    },

    /**
     * The main update loop. Called automatically when the Scene steps.
     *
     * @method Phaser.Cameras.Scene2D.CameraManager#update
     * @protected
     * @since 3.0.0
     *
     * @param {number} timestep - The timestep value.
     * @param {number} delta - The delta value since the last frame.
     */
    update: function (timestep, delta)
    {
        for (var i = 0; i < this.cameras.length; i++)
        {
            this.cameras[i].update(timestep, delta);
        }
    },

    /**
     * Resizes all cameras to the given dimensions.
     *
     * @method Phaser.Cameras.Scene2D.CameraManager#resize
     * @since 3.2.0
     *
     * @param {number} width - The new width of the camera.
     * @param {number} height - The new height of the camera.
     */
    resize: function (width, height)
    {
        for (var i = 0; i < this.cameras.length; i++)
        {
            this.cameras[i].setSize(width, height);
        }
    },

    /**
     * The Scene that owns this plugin is shutting down.
     * We need to kill and reset all internal properties as well as stop listening to Scene events.
     *
     * @method Phaser.Cameras.Scene2D.CameraManager#shutdown
     * @private
     * @since 3.0.0
     */
    shutdown: function ()
    {
        this.main = undefined;

        for (var i = 0; i < this.cameras.length; i++)
        {
            this.cameras[i].destroy();
        }

        this.cameras = [];

        var eventEmitter = this.systems.events;

        eventEmitter.off('update', this.update, this);
        eventEmitter.off('shutdown', this.shutdown, this);
    },

    /**
     * The Scene that owns this plugin is being destroyed.
     * We need to shutdown and then kill off all external references.
     *
     * @method Phaser.Cameras.Scene2D.CameraManager#destroy
     * @private
     * @since 3.0.0
     */
    destroy: function ()
    {
        this.shutdown();

        this.scene.sys.events.off('start', this.start, this);

        this.scene = null;
        this.systems = null;
    },

    /**
     * A reference to Camera 1 in the Camera Manager.
     * 
     * Create additional cameras using the `add` method.
     *
     * @name Phaser.Cameras.Scene2D.CameraManager#camera1
     * @type {Phaser.Cameras.Scene2D.Camera}
     * @readOnly
     * @since 3.11.0
     */
    camera1: {

        get: function ()
        {
            return this.cameras[0];
        }

    },

    /**
     * A reference to Camera 2 in the Camera Manager.
     * 
     * This will be `undefined` by default unless you have created new cameras via `add` or `addExisting`.
     *
     * @name Phaser.Cameras.Scene2D.CameraManager#camera2
     * @type {Phaser.Cameras.Scene2D.Camera}
     * @readOnly
     * @since 3.11.0
     */
    camera2: {

        get: function ()
        {
            return this.cameras[1];
        }

    },

    /**
     * A reference to Camera 3 in the Camera Manager.
     * 
     * This will be `undefined` by default unless you have created new cameras via `add` or `addExisting`.
     *
     * @name Phaser.Cameras.Scene2D.CameraManager#camera3
     * @type {Phaser.Cameras.Scene2D.Camera}
     * @readOnly
     * @since 3.11.0
     */
    camera3: {

        get: function ()
        {
            return this.cameras[2];
        }

    },

    /**
     * A reference to Camera 4 in the Camera Manager.
     * 
     * This will be `undefined` by default unless you have created new cameras via `add` or `addExisting`.
     *
     * @name Phaser.Cameras.Scene2D.CameraManager#camera4
     * @type {Phaser.Cameras.Scene2D.Camera}
     * @readOnly
     * @since 3.11.0
     */
    camera4: {

        get: function ()
        {
            return this.cameras[3];
        }

    },

    /**
     * A reference to Camera 5 in the Camera Manager.
     * 
     * This will be `undefined` by default unless you have created new cameras via `add` or `addExisting`.
     *
     * @name Phaser.Cameras.Scene2D.CameraManager#camera5
     * @type {Phaser.Cameras.Scene2D.Camera}
     * @readOnly
     * @since 3.11.0
     */
    camera5: {

        get: function ()
        {
            return this.cameras[4];
        }

    },

    /**
     * A reference to Camera 6 in the Camera Manager.
     * 
     * This will be `undefined` by default unless you have created new cameras via `add` or `addExisting`.
     *
     * @name Phaser.Cameras.Scene2D.CameraManager#camera6
     * @type {Phaser.Cameras.Scene2D.Camera}
     * @readOnly
     * @since 3.11.0
     */
    camera6: {

        get: function ()
        {
            return this.cameras[5];
        }

    },

    /**
     * A reference to Camera 7 in the Camera Manager.
     * 
     * This will be `undefined` by default unless you have created new cameras via `add` or `addExisting`.
     *
     * @name Phaser.Cameras.Scene2D.CameraManager#camera7
     * @type {Phaser.Cameras.Scene2D.Camera}
     * @readOnly
     * @since 3.11.0
     */
    camera7: {

        get: function ()
        {
            return this.cameras[6];
        }

    },

    /**
     * A reference to Camera 8 in the Camera Manager.
     * 
     * This will be `undefined` by default unless you have created new cameras via `add` or `addExisting`.
     *
     * @name Phaser.Cameras.Scene2D.CameraManager#camera8
     * @type {Phaser.Cameras.Scene2D.Camera}
     * @readOnly
     * @since 3.11.0
     */
    camera8: {

        get: function ()
        {
            return this.cameras[7];
        }

    },

    /**
     * A reference to Camera 9 in the Camera Manager.
     * 
     * This will be `undefined` by default unless you have created new cameras via `add` or `addExisting`.
     *
     * @name Phaser.Cameras.Scene2D.CameraManager#camera9
     * @type {Phaser.Cameras.Scene2D.Camera}
     * @readOnly
     * @since 3.11.0
     */
    camera9: {

        get: function ()
        {
            return this.cameras[8];
        }

    },

    /**
     * A reference to Camera 10 in the Camera Manager.
     * 
     * This will be `undefined` by default unless you have created new cameras via `add` or `addExisting`.
     *
     * @name Phaser.Cameras.Scene2D.CameraManager#camera10
     * @type {Phaser.Cameras.Scene2D.Camera}
     * @readOnly
     * @since 3.11.0
     */
    camera10: {

        get: function ()
        {
            return this.cameras[9];
        }

    }

});

PluginCache.register('CameraManager', CameraManager, 'cameras');

module.exports = CameraManager;
