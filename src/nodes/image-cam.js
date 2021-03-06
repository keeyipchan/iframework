// extends src/nodes/image.js which extends src/node-box-native-view.js

$(function(){

  var template = 
    '<div class="control">'+
      '<button class="startcamera">start camera</button>'+
      '<button class="sendimage">send</button>'+
      '<button class="stopcamera">stop</button>'+
      '<span style="position:absolute;width:0px;overflow:hidden;"><input type="file" class="fileinput" accept="image/*" /></span>'+
      '<button class="chooseimage">choose image</button>'+
      '<br />'+
      '<label><input type="checkbox" class="mirrorpreview" />mirror preview</label>'+
      // '<label><input type="checkbox" class="showonionskin" />show onionskin</label>'+
    '</div>'+
    '<div class="info" />';

  Iframework.NativeNodes["image-cam"] = Iframework.NativeNodes["image"].extend({

    template: _.template(template),
    info: {
      title: "cam",
      description: "webcam (HTML5 getUserMedia with Flash backup)"
    },
    events: {
      "click .startcamera": "startCam",
      "click .sendimage":   "inputsend",
      "click .stopcamera":  "stopCam",
      "click .chooseimage": "chooseImage",
      "change .fileinput":  "choseImage",
      "change .mirrorpreview": "mirrorPreview"
    },
    initializeModule: function(){
      this.canvas.width = 10;
      this.canvas.height = 10;
      this._crop = { left:0, top:0, width:640, height:480 };

      this.$("button").button();
      this.$(".stopcamera").hide();
      this.$(".sendimage").hide();

      if ( !window.URL ) {
        window.URL = window.webkitURL || window.msURL || window.oURL || false;
      }
      if ( !navigator.getUserMedia ) {
        navigator.getUserMedia = navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia || false;
      }
      if ( !navigator.getUserMedia ) {
        this.$(".startcamera").button({
          label: "demo video"
        });
      }

    },
    _camStarted: false,
    _placeholderWarning: null,
    startCam: function(){
      var self = this;
      this.$("button").hide();
      this.$(".stopcamera").show();
      this.$(".sendimage").show();

      if (!this._video) {
        this._video = document.createElement("video");
        this._video.autoplay = true;
        $(this._video).on("loadedmetadata", function(e){
          self.setSizes();
        });
      }

      if (navigator.getUserMedia) {
        navigator.getUserMedia( { video: true, audio: false }, function(stream){
          self._stream = stream;
          if (navigator.mozGetUserMedia) {
            // HACK for ff
            self._video.mozSrcObject = stream;
            self._video.play();
          } else {
            if (window.URL.createObjectURL) {
              self._video.src = window.URL.createObjectURL(stream);
            } else {
              self._video.src = stream;
            }
          }
          // Sets up frame draw ms
          self.inputfps(self._fps);
          self._placeholderWarning = null;
          self._camStarted = true;
          self._triggerRedraw = true;
        }, function(error){
          // this.$("button").show();
          // this.$(".stopcamera").hide();
          self._placeholderWarning = "(denied webcam access)";
          self.setupPlaceholderVideo();
        });
      } else {
        this._placeholderWarning = "(no getUserMedia webcam)";
        this.setupPlaceholderVideo();
      }
    },
    stopCam: function(){
      if (this._video) {
        this._video.pause();
        if (this._video.mozSrcObject) {
          // HACK for ff
          this._video.mozSrcObject = null;
        }
        this._video = null;
      }
      if (this._stream && this._stream.stop) {
        this._stream.stop();
      }
      this.$("button").show();
      this.$(".stopcamera").hide();
      this.$(".sendimage").hide();
    },
    mirrorPreview: function(event) {
      if (event.target.checked) {
        // Mirror
        $(this.canvas).css({
          "-webkit-transform": "scale(-1, 1)",
          "-moz-transform": "scale(-1, 1)",
          "-o-transform": "scale(-1, 1)",
          "transform": "scale(-1, 1)"        
        });
      } else {
        // No mirror
        $(this.canvas).css({
          "-webkit-transform": "scale(1, 1)",
          "-moz-transform": "scale(1, 1)",
          "-o-transform": "scale(1, 1)",
          "transform": "scale(1, 1)"        
        });
      }
    },
    setupPlaceholderVideo: function(){
      // Video file instead of webcam
      $(this._video)
        .attr({
          "autoplay": "true",
          "loop": "true"
        })
        .html(
          '<source src="img/no-webcam.mp4" type="video/mp4" />'+
          '<source src="img/no-webcam.webm" type="video/webm" />'
        )
        .on('ended', function(){
          this.play();
        });
      // Sets up frame draw ms
      this.inputfps(10);
      this._camStarted = true;
      this._triggerRedraw = true;
    },
    setSizes: function(){
      var input;
      if (this._video) {
        input = this._video;
        // Here we find the webcam's reported size
        this._video.width = this._video.videoWidth;
        this._video.height = this._video.videoHeight;
        if (!this._video.height) {
          // Firefox takes its time; try again in 0.5s
          var self = this;
          window.setTimeout(function(){
            self.setSizes();
          }, 500);
          return false;
        }
      } else if (this._image) {
        input = this._image;
      } else {
        return false;        
      }

      // Called from this._video loadedmetadata
      var w = this._width;
      var h = this._height;
      this.canvas.width = w;
      this.canvas.height = h;
      var ratio = w/h;

      var inputWidth = input.width;
      var inputHeight = input.height;
      var info = "input: "+inputWidth+"x"+inputHeight+", output: "+w+"x"+h;
      if (this._placeholderWarning) {
        info += " "+this._placeholderWarning;
      }
      this.$(".info").text(info);

      var camRatio = inputWidth/inputHeight;

      if (ratio >= camRatio) {
        this._crop.width = inputWidth;
        this._crop.height = inputWidth/ratio;
        this._crop.left = 0;
        this._crop.top = Math.floor((inputHeight-this._crop.height)/2);
      } else {
        this._crop.width = inputHeight*ratio;
        this._crop.height = inputHeight;
        this._crop.left = Math.floor((inputWidth-this._crop.width)/2);
        this._crop.top = 0;
      }
    },
    drawFrame: function(){
      if (!this._camStarted || !this._video || !this._video.height) { return false; }
      this.context.drawImage(this._video, this._crop.left, this._crop.top, this._crop.width, this._crop.height, 0, 0, this._width, this._height);
      this.send("stream", this.canvas);
      if (this.sendNext) {
        this.send("image", this.canvas);
        this.sendNext = false;
      }
    },
    sendNext: false,
    inputsend: function () {
      this.sendNext = true;
    },
    resetSizes: false,
    inputwidth: function(w){
      this._width = w;
      this.resetSizes = true;
      this._triggerRedraw = true;
    },
    inputheight: function(h){
      this._height = h;
      this.resetSizes = true;
      this._triggerRedraw = true;
    },
    _ms: 1000/20,
    inputfps: function(f){
      if (f <= 0) {
        this._fps = 0;
      } else if (0 < f && f <= this.inputs.fps.max) {
        this._fps = f;
        this._ms = 1000/f;
      }
    },
    disconnectEdge: function(edge) {
      // Called from Edge.disconnect();
      if (edge.Target.id === "background") {
        this._background = null;
        this._triggerRedraw = true;
      }
    },
    remove: function(){
      if (this._stream && this._stream.stop) {
        this._stream.stop();
      }
    },
    chooseImage: function(){
      this.$(".fileinput").trigger("click");
    },
    choseImage: function (event){
      // Thanks Robert Nyman https://hacks.mozilla.org/2012/04/taking-pictures-with-the-camera-api-part-of-webapi/
      // Get a reference to the taken picture or chosen file
      var files = event.target.files;
      if (files.length > 0) {
        this.loadImage(files[0]);
      }
    },
    loadImage: function(file) {
      this._video = null;
      var self = this;
      this._image = new Image();
      this._image.onload = function (event) {
        self.loadedImage(event);
      };
      try {
        // Create ObjectURL
        var imgURL = window.URL.createObjectURL(file);

        // Set img src to ObjectURL
        this._image.src = imgURL;

        // Revoke ObjectURL
        window.URL.revokeObjectURL(imgURL);
      }
      catch (e) {
        try {
          // Fallback if createObjectURL is not supported
          var fileReader = new FileReader();
          fileReader.onload = function (event) {
            this._image.src = event.target.result;
          };
          fileReader.readAsDataURL(file);
        }
        catch (e) {
          console.warn("Neither createObjectURL nor FileReader are supported");
        }
      }
    },
    loadedImage: function(event) {
      // event.target is this._image
      this.setSizes();
      this.context.drawImage(this._image, this._crop.left, this._crop.top, this._crop.width, this._crop.height, 0, 0, this._width, this._height);

      this.send("stream", this.canvas);
      this.send("image", this.canvas);
    },
    redraw: function(){
      // Called from NodeBoxNativeView.renderAnimationFrame()
      if (this.resetSizes) {
        this.setSizes();
        this.resetSizes = false;
      }
    },
    _lastRedraw: 0,
    renderAnimationFrame: function (timestamp) {
      // Get a tick from GraphView.renderAnimationFrame()
      // this._valueChanged is set by NodeBox.receive()
      if (this._triggerRedraw) {
        this._triggerRedraw = false;
        this.redraw(timestamp);
      }
      if (this._fps && this._ms) {
        if (timestamp-this._lastRedraw >= this._ms) {
          this.drawFrame();
          this._lastRedraw = timestamp;
        }
      }
    },
    inputs: {
      width: {
        type: "int",
        description: "video width",
        min: 1,
        max: 1920,
        "default": 320
      },
      height: {
        type: "int",
        description: "video height",
        min: 1,
        max: 1080,
        "default": 240
      },
      fps: {
        type: "number",
        description: "frames per second to update the canvas",
        min: 0,
        max: 30,
        "default": 20
      },
      send: {
        type: "bang",
        description: "send the image"
      }
    },
    outputs: {
      stream: {
        type: "image",
        description: "sends constant stream of images"
      },
      image: {
        type: "image",
        description: "sends image only when \"send\" is hit"
      }
    }

  });


});
