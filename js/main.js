var wavepad = (function () {

    var surface,
        finger,
        source,
        nodes = {},
        myAudioContext,
        myAudioAnalyser,
        mySpectrum,
        impulseResponse,
        hasTouch = 'ontouchstart' in window || 'createTouch' in document,
        eventStart = hasTouch ? 'touchstart' : 'mousedown',
        eventMove = hasTouch ? 'touchmove' : 'mousemove',
        eventEnd = hasTouch ? 'touchend' : 'mouseup',
        isMuted = false;

        return {

            init: function () {
                var doc = document;

                if ('webkitAudioContext' in window || 'AudioContext' in window) {
                    myAudioContext = new webkitAudioContext() || AudioContext();
                } else {
                    alert('Your browser does not support Web Audio API');
                    return;
                }

                var request = new XMLHttpRequest();
                request.open("GET", "ir/impulse.wav", true);
                request.responseType = "arraybuffer";
                 
                request.onload = function () {
                    impulseResponse = myAudioContext.createBuffer(request.response, false);
                }
                request.send();

                doc.getElementById('waveform').addEventListener('change', wavepad.sliderChange, false);
                doc.getElementById('filter-type').addEventListener('change', wavepad.filterChange, false);
                doc.getElementById('pan').addEventListener('change', wavepad.sliderChange, false);
                doc.getElementById('reverb').addEventListener('click', wavepad.toggleReverb, false);

                surface = doc.querySelector('.surface');
                surface.addEventListener(eventStart, wavepad.play, false);

                finger = doc.querySelector('.finger');

                doc.querySelector('.surface').addEventListener('touchmove', function (e) {
                    e.preventDefault();
                });
            },

            routeSounds: function (source) {
                var doc = document;
                var filterType = doc.querySelector('#filter-type').value;
                var reverb = doc.querySelector('#reverb').innerHTML.toLowerCase();
                var panX = doc.querySelector('#pan').value;

                nodes.filter = myAudioContext.createBiquadFilter();
                
                nodes.volume = myAudioContext.createGainNode();
                nodes.panner = myAudioContext.createPanner();

                if (reverb === 'on') {
                    nodes.convolver = myAudioContext.createConvolver();
                    nodes.convolver.buffer = impulseResponse;
                }

                nodes.filter.type = filterType;
                nodes.volume.gain.value = 1;
                
                nodes.panner.setPosition(panX, 0, 0);

                myAudioAnalyser = myAudioContext.createAnalyser();
                myAudioAnalyser.smoothingTimeConstant = 0.85;

                source.connect(nodes.filter);
                nodes.filter.connect(nodes.panner);

                if (reverb === 'on') {
                    nodes.filter.connect(nodes.convolver);
                    nodes.convolver.connect(nodes.panner);
                } else {
                    nodes.filter.connect(nodes.panner);
                }
                
                nodes.panner.connect(nodes.volume);
                nodes.volume.connect(myAudioAnalyser);
                myAudioAnalyser.connect(myAudioContext.destination);

                return source;
            },

            play: function (e) {
                var x = e.pageX - surface.offsetLeft;
                var y = e.pageY - surface.offsetTop;

                if (myAudioContext.activeSourceCount > 0) {
                    wavepad.kill();
                }

                source = myAudioContext.createOscillator();
                source.type = document.querySelector('#waveform').value; // sine wave
                source = wavepad.routeSounds(source);
                source.frequency.value = x;
                nodes.filter.frequency.value = 512 - y;
                source.noteOn(0);

                finger.style.webkitTransform = finger.style.MozTransform = finger.style.msTransform = finger.style.OTransform = finger.style.transform = 'translate(' + (x - finger.offsetWidth / 2) + 'px,' + (y - finger.offsetHeight / 2) + 'px)';
                finger.classList.add('active');
                surface.classList.add('pressed');

                wavepad.animateSpectrum();

                surface.addEventListener(eventMove, wavepad.effect, false);
                surface.addEventListener(eventEnd, wavepad.stop, false);
            },

            stop: function (e) {
                var x = e.pageX - surface.offsetLeft;
                var y = e.pageY - surface.offsetTop;

                if (myAudioContext.activeSourceCount > 0) {
                    source.frequency.value = x;
                    nodes.filter.frequency.value = 512 - y;
                    source.noteOff(0);
                }

                finger.classList.remove('active');
                surface.classList.remove('pressed');

                setTimeout(function () {
                    window.cancelAnimationFrame(mySpectrum);
                }, 3000);

                surface.removeEventListener(eventMove, wavepad.effect, false);
                surface.removeEventListener(eventEnd, wavepad.stop, false);
            },

            kill: function () {
                source.noteOff(0);
                finger.classList.remove('active');
                surface.classList.remove('pressed');

                setTimeout(function () {
                    window.cancelAnimationFrame(mySpectrum);
                }, 3000);

                surface.removeEventListener(eventMove, wavepad.effect, false);
                surface.removeEventListener(eventEnd, wavepad.stop, false);
            },

            effect: function (e) {
                var x = e.pageX - surface.offsetLeft;
                var y = e.pageY - surface.offsetTop;

                if (myAudioContext.activeSourceCount > 0) {
                    source.frequency.value = x;
                    nodes.filter.frequency.value = 512 - y;
                    finger.style.webkitTransform = finger.style.MozTransform = finger.style.msTransform = finger.style.OTransform = finger.style.transform = 'translate(' + (x - finger.offsetWidth / 2) + 'px,' + (y - finger.offsetHeight / 2) + 'px)';
                }

            },

            sliderChange: function (slider) {
                if (myAudioContext.activeSourceCount > 0) {
                    if (slider.id == 'waveform') {
                        wavepad.stop();
                        wavepad.play();
                    } else if (slider.id === 'frequency') {
                        source.frequency.value = slider.value;
                    } else if (slider.id === 'pan') {
                        nodes.panner.setPosition(slider.value, 0, 0);
                    }
                }
            },

            filterChange: function (slider) {
                if (myAudioContext.activeSourceCount > 0) {
                    if (slider.id == 'filter-type') {
                        nodes.filter.type = slider.value;
                    }
                }
            },

            toggleReverb: function () {
                var doc = document;
                var button = doc.querySelector('#reverb');
                var state = button.innerHTML.toLowerCase();

                if (state === 'on') {
                    button.innerHTML = 'Off';
                } else {
                    button.innerHTML = 'On';
                }
            },

            animateSpectrum: function () {
                mySpectrum = requestAnimationFrame(wavepad.animateSpectrum, document.querySelector('canvas'));
                wavepad.drawSpectrum();
            },

            drawSpectrum: function () {
                var canvas = document.querySelector('canvas');
                var ctx = canvas.getContext('2d');
                var width = canvas.width;
                var height = canvas.height;
                var bar_width = 20;
     
                ctx.clearRect(0, 0, width, height);
                ctx.fillStyle = '#1d1c25';
     
                var freqByteData = new Uint8Array(myAudioAnalyser.frequencyBinCount);
                myAudioAnalyser.getByteFrequencyData(freqByteData);
     
                var barCount = Math.round(width / bar_width);
                for (var i = 0; i < barCount; i++) {
                    var magnitude = freqByteData[i];
                    // some values need adjusting to fit on the canvas
                    ctx.fillRect(bar_width * i, height, bar_width - 1, -magnitude * 2);
                }
            }
        };
}());

window.addEventListener("DOMContentLoaded", wavepad.init, true);