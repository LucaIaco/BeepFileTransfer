/**
 * MIT License
 *
 * Copyright (c) 2022 Luca Iaconis. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.

 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 * 
 * @fileoverview
 * - BeepFileTransfer namespace contains all the classes needed to make the tool to work
 * - No external library needed, all is based on the Web Audio API
 * 
 * @author Luca Iaconis
 */

'strict mode';
var BeepFileTransfer = {};

/**
 * ======================================================
 * BeepFileTransfer.Core class definition
 * ======================================================
 */
'strict mode';
BeepFileTransfer.Core = class {
	
	/**
	 * =============== Properties ===============
	 */
		
	/**
	 * Currently displayed view on the screen
	 */
	static _displayedView = null;

	/**
	 * Reference to the callback called when the user, in Sender mode, picks a file from the input type file
	 */
	static _onFileChanged = null;

	/**
	 * Reference to the fileworker which is processing the file
	 */
	static _fileWorker = null;
	
	/**
	 * Reference to the beep listener class which responsible of recognizing the sound and determine the frequency ( USED ONLY in Receiver mode )
	 */
	static _beepListener = null;

	/**
	 * Indicates if the Sender/Receiver is currently running
	 */
	static _isRunning = false;

	/**
	 * The Sender/Receiver Datetime when the process started
	 */
	static _startDate = null;

	/**
	 * The timer used for updating and displaying the elapse time
	 */
	static _elapseTimer = null;
	
	/**
	 * Enum for the supported Display view options.
	 * - home: Displays the inital home view
	 * - help: Displays the help popup
	 * - sendFile: Displays the "Send file" view
	 * - receiveFile: Displays the "Receive file" view
	 * @readonly
	 */
	static ViewOption = Object.freeze({
		home: { id: "homeBox" },
		help: { id: "helpBox" },
		sendFile: { id: "sendBox", lblProgressId: "lblProgress", lblElapsTimeId: "lblElapsTimeId", lblFileId: "lblFile", canvasWaveFormId:"canvasWaveForm" },
		receiveFile: { id: "receiveBox", lblProgressId: "lblProgress1", lblElapsTimeId: "lblElapsTimeId1", lblFileId: "lblFile1", canvasWaveFormId:"canvasWaveForm1"}
	});
	
	/**
	 * =============== Methods ===============
	 */
	
	/**
	 * Displays the view with the given option on the screen, performing any necessary setup
	 * 
	 * @public
	 * @param {BeepFileTransfer.Core.ViewOption} view the option to be used in order to display the corresponding view
     * 
	 */
    static loadView(view) {
        let div = document.getElementById(view.id);
        if (div === null || div === "undefined") { return }

        // Hide all the views in order to display only the desired one
        for (var viewOption in BeepFileTransfer.Core.ViewOption) {
            let id = BeepFileTransfer.Core.ViewOption[viewOption].id;
            document.getElementById(id).style.display = "none";
        }
        
        // remove andy display:none in order to show up the view
        div.style.display = null;

        let previousView = this._displayedView;

        // keep track of the displaying view except of help view
        if (view != BeepFileTransfer.Core.ViewOption.help){
            this._displayedView = view
        } else {
			this._populateDynamicHelpViewPart();
		}

        // If the view is not already shown, do any necessary custom action
        if (this._displayedView !== null && this._displayedView != previousView) {
            switch (view){
                case BeepFileTransfer.Core.ViewOption.home: {
					switch (previousView) {
                        case BeepFileTransfer.Core.ViewOption.sendFile: { this.stopSending(); break; }
                        case BeepFileTransfer.Core.ViewOption.receiveFile: { this.stopReceiving(); break; }
                        default: { break; }
                    }
					this._populateCommonInputsFromParams();
                    break;
                }
                case BeepFileTransfer.Core.ViewOption.sendFile: {
					this._populateCommonParamsFromInputs();
                    this._setupSender();
                    break;
                }
                case BeepFileTransfer.Core.ViewOption.receiveFile: {
                    this._populateCommonParamsFromInputs();
					this._setupReceiver();
                    break;
                }
                default: { break; }
            }
        }
        
    }
	
	/**
     * Displays the previously tracked view
     */
    static closeHelp() { if (this._displayedView !== null) { this.loadView(this._displayedView); } }
	
	/**
     * Show / Hide the common parameters in the home screen
     */
	static toggleSharedParams() {
		let isChecked = document.getElementById("checkShowParamsId").checked;
		document.getElementById("commonParamId").style.display = isChecked ? null : "none";
	}
	
	/**
     * Populate the help section for the hex -> frequency map sublist
     */
	static _populateDynamicHelpViewPart() {
		this._populateCommonParamsFromInputs();
		document.getElementById("helpDeltaFreqId").innerHTML = BeepFileTransfer.Utils.frequencyDeltaUnit().toFixed(2);
		// populate the help section for the hex -> frequency map sublist
		let helpHexFreqList = document.getElementById("helpHexFreqMapId");
		helpHexFreqList.innerHTML = "";
		for (let i=0; i<=0xF;i++) { 
			let keyFreq = BeepFileTransfer.Utils.minFrequency + i * BeepFileTransfer.Utils.frequencyDeltaUnit();
			let li = document.createElement("li");
			li.innerText = "0x"+ i.toString(16).toUpperCase() + " ⇔ " + keyFreq.toFixed(2) + " Hz ( " + (keyFreq - (BeepFileTransfer.Utils.frequencyDeltaUnit() / 2) + 1).toFixed(2) + " Hz , " + (keyFreq + BeepFileTransfer.Utils.frequencyDeltaUnit() / 2).toFixed(2) + " Hz)";
			helpHexFreqList.appendChild(li);
		}
	}
	
	/**
     * Populates the input text fields in the home view with from the common parameters
     */
	static _populateCommonInputsFromParams() {
		document.getElementById("commonMinFreqId").value = BeepFileTransfer.Utils.minFrequency;
		document.getElementById("commonMaxFreqId").value = BeepFileTransfer.Utils.maxFrequency;
		document.getElementById("commonSepFreqId").value = BeepFileTransfer.Utils.separatorFrequency;
		document.getElementById("commonBeepDurationId").value = BeepFileTransfer.Utils.defaultBeepDuration;
		document.getElementById("commonBeepVolumeId").value = BeepFileTransfer.Utils.defaultBeepVolume;
		
		let ixType = 0;
		let options = document.getElementById("commonOscillatorTypeId").options;
		for (let i=0; i<options.length; i++) { if (options[i].value == BeepFileTransfer.Utils.defaultOscillatorType) { ixType = i; break; } }
		document.getElementById("commonOscillatorTypeId").selectedIndex = ixType;
	}
	
	/**
     * Populates the common parameters from the input text fields in the home view
     */
	static _populateCommonParamsFromInputs() {
		BeepFileTransfer.Utils.minFrequency = isNaN(document.getElementById("commonMinFreqId").value) ? 440 : parseInt(document.getElementById("commonMinFreqId").value);
		BeepFileTransfer.Utils.maxFrequency = isNaN(document.getElementById("commonMaxFreqId").value) ? 1760 : parseInt(document.getElementById("commonMaxFreqId").value);
		BeepFileTransfer.Utils.separatorFrequency = isNaN(document.getElementById("commonSepFreqId").value) ? 1900 : parseInt(document.getElementById("commonSepFreqId").value);
		BeepFileTransfer.Utils.defaultBeepDuration = isNaN(document.getElementById("commonBeepDurationId").value) ? 270 : parseInt(document.getElementById("commonBeepDurationId").value);
		BeepFileTransfer.Utils.defaultBeepVolume = isNaN(document.getElementById("commonBeepVolumeId").value) ? 50 : parseInt(document.getElementById("commonBeepVolumeId").value);
	
		// validate the separator frequency (shall not fall in the valid frequency range). If so, just move it over the maxFrequency + delta unit to be safe
		if (BeepFileTransfer.Utils._hexNumberFromFrequency(BeepFileTransfer.Utils.separatorFrequency) !== null) {
			BeepFileTransfer.Utils.separatorFrequency = BeepFileTransfer.Utils.maxFrequency + BeepFileTransfer.Utils.frequencyDeltaUnit();
		}
		
		let newType = document.getElementById("commonOscillatorTypeId").options[document.getElementById("commonOscillatorTypeId").selectedIndex].value;
		BeepFileTransfer.Utils.defaultOscillatorType = newType;
	}
	
	/**
     * Indicates if the current selected view is the Sender or the Receiver view
     * 
     * @private
     * @return {Boolean} true if the contion is met
     */
    static _isSenderReceiverView() { return (this._displayedView == BeepFileTransfer.Core.ViewOption.sendFile || this._displayedView == BeepFileTransfer.Core.ViewOption.receiveFile ) }
	
	/**
     * Start the process of sending the selected file in the "Send file" view
     * 
     * @public
     */
    static async startSending() {
        if (BeepFileTransfer.Core._isSenderReceiverView() == false ) { return }
        if (BeepFileTransfer.Core._isRunning == true) { return }
        // disable the Buttons
        document.getElementById("btnInputFile").disabled = true;
        document.getElementById("btnStartSending").disabled = true;
		this._showElapsedTime(true);
		this._isRunning = true;
		this._showWaveForm(true);
		this._updateProgresses();
		// Make the first beep to normalize the receiver microphone
		this._updateMetaInformation();
		document.getElementById(BeepFileTransfer.Core._displayedView.lblFileId).innerHTML += " &lt; initial beep &gt;";
		await BeepFileTransfer.Utils.beepSeparator(1000);
		// Build the metaInfo object, convert as json string, then as byte array, and start sending it as beeps
		if (this._isRunning == true) {
			this._updateMetaInformation();
			document.getElementById(BeepFileTransfer.Core._displayedView.lblFileId).innerHTML += " &lt; Sending meta info &gt;";
			let utf8Encode = new TextEncoder();
			let bytesMetaInfo = utf8Encode.encode(JSON.stringify(this._fileWorker.metaInfo()));
			for (let i = 0; i < bytesMetaInfo.length && this._isRunning == true; i++) {
				// update the label on screen
				this._updateSenderPlayingFrequencies(bytesMetaInfo[i]);
				// play the beeps
				await BeepFileTransfer.Utils.beepsFromByte(bytesMetaInfo[i]);
			} 
		}
		// Make the beep to distantiate from the actual file stream to be transmitted
		if (this._isRunning == true) { 
			this._updateMetaInformation();
			document.getElementById(BeepFileTransfer.Core._displayedView.lblFileId).innerHTML += " &lt; Meta info terminated &gt;";
			await BeepFileTransfer.Utils.beepSeparator(1000); 
			this._updateMetaInformation();
		}
		// Start iterating over each read byte from the input file and generate the beeps, so that the receiver machine can listen and process in turn
		while( this._isRunning == true && await this._fileWorker.readNextByte() !== null ) {
			this._updateProgresses();
			let readByte = this._fileWorker.lastByte;
			// update the label on screen
			this._updateSenderPlayingFrequencies(readByte);
			// play the beeps
			await BeepFileTransfer.Utils.beepsFromByte(readByte);
		}
		this.stopSending();
    }

    /**
     * Stops the process of sending the selected file in the "Send file" view
     */
    static stopSending() {
        this._setupSender();
    }
	
	/**
     * Start the process of receiving a file from a Sender device
     * 
     * @public
     */
    static async startReceiving() {
        if (BeepFileTransfer.Core._isSenderReceiverView() == false ) { return }
        if (BeepFileTransfer.Core._isRunning == true) { return }
        // disable the Buttons
        document.getElementById("btnStartReceiving").disabled = true;
		this._showElapsedTime(true);
        this._isRunning = true;
		// Initialize the beep listener
		this._beepListener = new BeepFileTransfer.BeepListener();
		this._fileWorker = BeepFileTransfer.FileWorker.createWriter();
		let that = this;
		let result = await this._beepListener.initialize((detectedFrequency, detectedHexNumber) => {
			if (detectedHexNumber === null) { return }
			document.getElementById("lblDetectedFreq").innerHTML = "" + detectedFrequency.toFixed(2) + " Hz (0x" + detectedHexNumber.toString(16) + ")";
			// collect the byte fragments for the meta info object if not yet entirely received, otherwise collect the actual file bytes
			if (that._fileWorker.inputFileName === null) {
				that._fileWorker.writerAcquireMetaInfo(detectedHexNumber);
			} else {
				that._updateMetaInformation();
				that._updateProgresses();
				that._fileWorker.writerCommitPendingByte(detectedHexNumber);
			}
			// check if the data transmission is completed. In case, stop the receiver
			if (that._fileWorker.progress() == 1.0) {
				that.stopReceiving();
			}
		});
		// initialization fails (eg user declined the microphone permission), then stop right away
        if (result == false) {
			this.stopReceiving();
			return;
		} else {
			document.getElementById(BeepFileTransfer.Core._displayedView.lblFileId).innerHTML = "&lt; acquiring metadata &gt;";
			this._showWaveForm(true);
			this._beepListener.start();
		}
    }
	
	/**
     * Stops the process of receiving the selected file in the "Send file" view
     * 
     * @public
     */
    static stopReceiving() {
		if (this._beepListener !== null) {
			this._beepListener.close();
			this._beepListener = null;
		}
        this._setupReceiver();
    }
	
	/**
     * Initializes the Sender view
     * 
     * @public
     */
    static _setupSender() {
		// Configure the controls to the initial state
        document.getElementById("btnInputFile").disabled = false;
        document.getElementById("btnStartSending").disabled = true;
		document.getElementById("lblPlayingFreq").innerHTML = "n/a";
		this._showWaveForm(false);
        
        let fileSelector = document.getElementById("inputFile");
        // Remove any previously attached observer and selected file
        if (BeepFileTransfer.Core._onFileChanged !== null) {
            fileSelector.removeEventListener("change", BeepFileTransfer.Core._onFileChanged);
            fileSelector.value = "";
        }
        // Reset the interface and the file worker
        this._reset();
        
        // Attach a new observer for the file picker change 
        this._onFileChanged = (event) => {
            let files = event.target.files;
            BeepFileTransfer.Core._reset();
            // If no file was selected, then abort
            if (files === null || files.length == 0) { 
                // disable the 'Start sending' button and 'Chunk size'
                document.getElementById("btnStartSending").disabled = true;
                return 
            }
            
            // create the file worked based on the selected file
            BeepFileTransfer.Core._fileWorker = BeepFileTransfer.FileWorker.createReader(files[0]);
            
            // update the meta information on the screen
            BeepFileTransfer.Core._updateMetaInformation();
            // enable the 'Start sending' button and disable the dropdown
            document.getElementById("btnStartSending").disabled = false;
        }
        fileSelector.addEventListener('change', BeepFileTransfer.Core._onFileChanged);
	}
	
	/**
     * Initializes the Receiver view
     * 
     * @public
     */
    static _setupReceiver() {
		// Configure the control to the initial state
        document.getElementById("btnStartReceiving").disabled = false;
		document.getElementById("lblDetectedFreq").innerHTML = "n/a";
        // Reset the interface and the file worker
        this._reset();
		this._showWaveForm(false);
	}
	
	/**
     * Reset the shared states
     * 
     * @private
     */
    static _reset() {
        this._isRunning = false;
        this._fileWorker = null;
        this._showElapsedTime(false);
        this._updateMetaInformation();
        this._updateProgresses();
    }
	
	 /**
	 * Displays/Updates the meta information of the file which is getting processed
	 * 
	 * @private
	 */
    static _updateMetaInformation() {
        if (BeepFileTransfer.Core._isSenderReceiverView() == false ) { return }
        let metaInfo = null;
        if (BeepFileTransfer.Core._fileWorker !== null) { metaInfo = BeepFileTransfer.Core._fileWorker.metaInfo(); }
        document.getElementById(BeepFileTransfer.Core._displayedView.lblFileId).innerHTML = (metaInfo === null ? "n/a" : metaInfo.a + " (" + BeepFileTransfer.Utils.formatBytes(metaInfo.c) + ")");
    }

    /**
	 * Displays/Updates the progresses on the file which is getting processed
	 * 
	 * @private
	 */
    static _updateProgresses() {
        if (BeepFileTransfer.Core._isSenderReceiverView() == false ) { return }
        // Display default state if not running
        if (BeepFileTransfer.Core._isRunning == false) {
            document.getElementById(BeepFileTransfer.Core._displayedView.lblProgressId).innerHTML = "n/a";
            return;
        }
        if (BeepFileTransfer.Core._fileWorker !== null) {
            document.getElementById(BeepFileTransfer.Core._displayedView.lblProgressId).innerHTML = (BeepFileTransfer.Core._fileWorker.progress() * 100).toFixed(2) + " % (" + BeepFileTransfer.Core._fileWorker.curBytes + ")";
        }
    }
	
	/**
	 * Displays/Updates the playing frequencies based on the given byte value (Sender mode only)
	 * @param {number} the byte to represent on screen
	 * 
	 * @private
	 */
	static _updateSenderPlayingFrequencies(byteNumber) {
		let hexNumbers = BeepFileTransfer.Utils._leftRightHexFromByteNumber(byteNumber);
		let freq1 = BeepFileTransfer.Utils._frequencyFromHexNumber(hexNumbers[0]);
		let freq2 = BeepFileTransfer.Utils._frequencyFromHexNumber(hexNumbers[1]);
		document.getElementById("lblPlayingFreq").innerHTML = "Freq 1: " + freq1.toFixed(2) + " Hz (0x" + hexNumbers[0].toString(16) + ") | Freq 2: " + freq2.toFixed(2) + " Hz (0x" + hexNumbers[1].toString(16) + ")";
	}
	
	/**
     * Starts/Stops the timer for displaying and updating the elapsed time
     * @param {Boolean} start whether the timer should start or stop running
     */
    static _showElapsedTime(start) {
        if (BeepFileTransfer.Core._isSenderReceiverView() == false ) { return }
        if (start === true) {
            this._startDate = Date.now();
            document.getElementById(BeepFileTransfer.Core._displayedView.lblElapsTimeId).innerHTML = BeepFileTransfer.Utils.elapsedTime(this._startDate);
            this._elapseTimer = setInterval(() => {
                if (BeepFileTransfer.Core._isSenderReceiverView() == false ) { return }
                document.getElementById(BeepFileTransfer.Core._displayedView.lblElapsTimeId).innerHTML = BeepFileTransfer.Utils.elapsedTime(this._startDate);
            }, 1000);
        }else {
            clearInterval(this._elapseTimer);
            this._elapseTimer = null;
            this._startDate = null;
            document.getElementById(BeepFileTransfer.Core._displayedView.lblElapsTimeId).innerHTML = "n/a";
        }
    }
	
	/**
     * Shows / Hides the oscillator wave canvas on the screen, which displys the wave form of played or recognized audio frequencies
     * @param {boolean} show or hide the canvas (on hide, the analyzer gets also set to null IF this is the SENDER ONLY)
     */
	static _showWaveForm(show) {
		if (this._isSenderReceiverView() == false ) { return }
		let canvas = document.getElementById(BeepFileTransfer.Core._displayedView.canvasWaveFormId);
		if (show == false) {
			canvas.style.display = "none";
			if (this._displayedView == BeepFileTransfer.Core.ViewOption.sendFile) {
				BeepFileTransfer.Utils.analyzer = null;
			}
			return
		}
		canvas.style.display = null;
		
		let c = canvas.getContext("2d");
		// setup the canvas and context
		canvas.width = 1080;
		canvas.height = 720;
		c.fillStyle = "#181818";
		c.fillRect(0, 0, canvas.width, canvas.height);
		c.strokeStyle = "#33ee55";
		c.beginPath();
		c.moveTo(0, canvas.height / 2);
		c.lineTo(canvas.width, canvas.height / 2);
		c.stroke();
		
		// initialize the analyzer for the sender mode
		if (this._displayedView == BeepFileTransfer.Core.ViewOption.sendFile) {
			BeepFileTransfer.Utils.analyzer = new AnalyserNode(BeepFileTransfer.Utils.senderAudioContext, { smoothingTimeConstant: 1, fftSize: 2048 })
		}
		
		let analyzer = ( this._displayedView == BeepFileTransfer.Core.ViewOption.sendFile ? BeepFileTransfer.Utils.analyzer : this._beepListener.analyzer );
		this._drawCanvasWaveForm(analyzer);
	}
	
	/**
     * Draws the wave form line in the dedicated canvas area
	 * @param {Analyzer} the reference to the web analyzer to be used
     */
	static _drawCanvasWaveForm(analyzer) {
		if (BeepFileTransfer.Core._isRunning == false) { return }
		let canvas = document.getElementById(BeepFileTransfer.Core._displayedView.canvasWaveFormId);
		let c = canvas.getContext("2d");
		let dataArray = new Uint8Array(analyzer.frequencyBinCount);
		analyzer.getByteTimeDomainData(dataArray);
		let segmentWidth = canvas.width / analyzer.frequencyBinCount;
		c.fillRect(0, 0, canvas.width, canvas.height);
		c.beginPath();
		c.moveTo(-100, canvas.height / 2);
		for (let i = 1; i < analyzer.frequencyBinCount; i += 1) {
			let x = i * segmentWidth;
			let v = dataArray[i] / 128.0;
			let y = (v * canvas.height) / 2;
			c.lineTo(x, y);
		}
		c.lineTo(canvas.width + 100, canvas.height / 2);
		c.stroke();
		
		let that = this;
		requestAnimationFrame(function() { that._drawCanvasWaveForm(analyzer); });
	}	
}

/**
 * ======================================================
 * BeepFileTransfer.Utils class definition
 * ======================================================
 */
'strict mode';
BeepFileTransfer.Utils = class {
	
	/**
	 * =============== Properties ===============
	 */
	
	/**
	 * The audio context used to generate the beep sound from a given frequency
	 */
	static senderAudioContext = new AudioContext();

	/**
	 * The currently set web audio analyzer used to show the wave form of the generated beep from the sender
	 */
	static analyzer = null;

	/**
	 * The supported lower frequency bound
	 */
	static minFrequency = 440;

	/**
	 * The supported upper frequency bound
	 */
	static maxFrequency = 1760;

	/**
	 * The supported separator frequency, used to distinguish two cosecutive beeps. 
	 * It SHALL NOT fall in the range between (minFrequency - frequencyDeltaUnit / 2) and minFrequency + frequencyDeltaUnit / 2
	 */
	static separatorFrequency = 1900;

	/**
	 * The frequency delta unit ( distance between two key frequencies in the spectrum between minFrequency and maxFrequency )
	 */
	static frequencyDeltaUnit() { return (this.maxFrequency - this.minFrequency) / 0xF }

	/**
	 * The default wave form type to be used by the oscillator (eg. sine, square, triangle)
	 */
	static defaultOscillatorType = "sine";
	
	/**
	 * The default used duration for each generated beep sound (in millisecs)
	 */
	static defaultBeepDuration = 270;
	
	/**
	 * The default used volume gain for each generated beep sound
	 */
	static defaultBeepVolume = 50;
	
	/**
	 * The default value of used to place a beep separator sound between the left and right hex of a byte transmission
	 */
	static defaultUseSeparator = true;
	
	/**
	 * =============== Methods ===============
	 */
	
	/**
	 * Generates a couple of beeps which represents the given byte value
	 *
	 * In case the "useSeparator" is true, this method will generate 4 beeps (left hex, separator, right hex, separator)
	 * 
	 * @param {number}  byteNumber - The byte number (0-255 or 0x0-0xFF) to be represented as couple of beeps
	 * @param {number}  duration - The duration of the beep sound in milliseconds.
	 * @param {number}  volume - The volume of the beep sound.
	 * @param {boolean} useSeparator - Indicates if the beep separator should be played between the byte beeps. If not provided, default is "true"
	 * 
	 * @returns {Promise} - A promise that resolves when the beep sound is finished.
	 */
	static beepsFromByte(byteNumber, duration, volume, useSeparator) {
		let hexNumbers = this._leftRightHexFromByteNumber(byteNumber);
		let separator = useSeparator || BeepFileTransfer.Utils.defaultUseSeparator;
		if (separator) {
			return this.beepFromHexNumber(hexNumbers[0], duration, volume).then(() => this.beepSeparator(duration, volume)).then(() => this.beepFromHexNumber(hexNumbers[1], duration, volume)).then(() => this.beepSeparator(duration, volume))
		} else {
			return this.beepFromHexNumber(hexNumbers[0], duration, volume).then(() => this.beepFromHexNumber(hexNumbers[1], duration, volume))
		}
	}
	
	/**
	 * Generates the "separator" beep frequency
	 * 
	 * @param {number} duration - The duration of the beep sound in milliseconds.
	 * @param {number} volume - The volume of the beep sound.
	 * 
	 * @returns {Promise} - A promise that resolves when the beep sound is finished.
	 */
	static beepSeparator(duration, volume) { return this.beep(this.separatorFrequency, duration, volume) }
	
	/**
	 * Converts the given hexadecimal number in a beep sound
	 * 
	 * @param {number} hexValue - The hexadecimal number to be represented as beep sound
	 * @param {number} duration - The duration of the beep sound in milliseconds.
	 * @param {number} volume - The volume of the beep sound.
	 * 
	 * @returns {Promise} - A promise that resolves when the beep sound is finished.
	 */
	static beepFromHexNumber(hexValue, duration, volume) {
		let freq = this._frequencyFromHexNumber(hexValue);
		return this.beep(freq, duration, volume);
	}
	
	/**
	 * Helper function to emit a beep sound in the browser using the Web Audio API.
	 * 
	 * @param {number} frequency - The frequency of the beep sound.
	 * @param {number} duration - The duration of the beep sound in milliseconds.
	 * @param {number} volume - The volume of the beep sound.
	 * 
	 * @returns {Promise} - A promise that resolves when the beep sound is finished.
	 */
	static beep(frequency, duration, volume){
		return new Promise((resolve, reject) => {
			// Set default duration if not provided
			duration = duration || BeepFileTransfer.Utils.defaultBeepDuration;
			frequency = frequency || BeepFileTransfer.Utils.minFrequency;
			volume = volume || BeepFileTransfer.Utils.defaultBeepVolume;
			try {
				let oscillatorNode = BeepFileTransfer.Utils.senderAudioContext.createOscillator();
				let gainNode = BeepFileTransfer.Utils.senderAudioContext.createGain();
				oscillatorNode.connect(gainNode);
				gainNode.connect(BeepFileTransfer.Utils.analyzer);
				
				// Set the oscillator frequency in hertz
				oscillatorNode.frequency.value = frequency;

				// Set the type of oscillator
				oscillatorNode.type = BeepFileTransfer.Utils.defaultOscillatorType;
				gainNode.connect(BeepFileTransfer.Utils.senderAudioContext.destination);

				// Set the gain to the volume
				gainNode.gain.value = volume * 0.01;

				// Start audio with the desired duration
				oscillatorNode.start(BeepFileTransfer.Utils.senderAudioContext.currentTime);
				oscillatorNode.stop(BeepFileTransfer.Utils.senderAudioContext.currentTime + duration * 0.001);

				// Resolve the promise when the sound is finished
				oscillatorNode.onended = () => {
					resolve();
				};
			} catch(error) {
				reject(error);
			}
		});
	}	

	/**
	 * Converts the given frequency in the corresponding single digit hexadecimal number
	 *
	 * This function, makes a quantization on the frequency range, giving a margin of approximation [x-(this.frequencyDeltaUnit/2)+1 , x+(this.frequencyDeltaUnit/2)]
	 * 
	 * @param {number} frequency - The frequency to be converted in hex number
	 * 
	 * @returns {number} - The hexadecimal number from the given frequency, or null if the number exceed the supported hex range 0-0xF
	 */
	static _hexNumberFromFrequency(frequency) {
		let deltaFrequency = frequency - this.minFrequency;
		let number = deltaFrequency / this.frequencyDeltaUnit();
		
		let result = Math.round(number);
		// the approx should not be symmetric, but will have 1 Hz less, to not overlap the adiacent frequency range
		let int_part = Math.trunc(number);
		let float_part = Math.abs(Number((number-int_part).toFixed(2)));
		if (float_part == 0.5) {
			result -= 1;
		}
		if (result < 0 || result > 0xF) { return null }
		return result
	}
	
	/**
	 * Converts the given hex value in the corresponding frequency
	 * 
	 * @param {number} hexValue - The hex number to be converted in frequency
	 * 
	 * @returns {number} - The resulting frequency in Hertz
	 */
	static _frequencyFromHexNumber(hexValue) {
		let deltaFrequency = hexValue * this.frequencyDeltaUnit();
		let freq = this.minFrequency + deltaFrequency;
		return freq;
	}
	
	/**
	 * Returns the left and right hex numbers from the given byte number (0x00 - 0xFF)
	 * 
	 * @param {number} byteNumber - The byte number to refer
	 * 
	 * @returns {array} - array of two numbers, left hex and right hex
	 */
	static _leftRightHexFromByteNumber(byteNumber) {
		let strByte = byteNumber.toString(16);
		let leftHex = 0;
		let rightHex = 0;
		// 0x00 - 0xF result in one char so left hex is set as 0, and the right hex is the given char parsed
		if (strByte.length == 1) {
			leftHex = 0;
			rightHex = parseInt(strByte.charAt(0),16); 
		} else {
			leftHex = parseInt(strByte.charAt(0),16); 
			rightHex = parseInt(strByte.charAt(1),16); 
		}		
		return [leftHex, rightHex]
	}
	
	/**
	 * Returns the single byte number (0x00 - 0xFF) from the given left and right hex numbers
	 * 
	 * @param {number} leftHex - The left hex number
	 * @param {number} rightHex - The right hex number
	 * 
	 * @returns {number} - The hexadecimal number from the given frequency.
	 */
	static _byteNumberFromLeftRightHex(leftHex, rightHex) {
		let strByte = leftHex.toString(16) + rightHex.toString(16);
		let byteNumber = parseInt(strByte, 16);
		return byteNumber;
	}
	
	/**
     * Returns the elapsed time from the given date in the format HH:MM:SS
     * @param {Date} fromDate the date from which making the differense with the current date
     * @return {String} the formatted string elapsed time
     */
    static elapsedTime(fromDate) { 
        if (fromDate === null) { return "00:00:00"; }
        let milliseconds = Date.now() - fromDate;
        let sec_num = Math.floor(milliseconds/1000);
        let hours   = Math.floor(sec_num / 3600);
        let minutes = Math.floor((sec_num - (hours * 3600)) / 60);
        let seconds = sec_num - (hours * 3600) - (minutes * 60);
    
        if (hours   < 10) {hours   = "0"+hours;}
        if (minutes < 10) {minutes = "0"+minutes;}
        if (seconds < 10) {seconds = "0"+seconds;}
        return hours + ':' + minutes + ':' + seconds;
    }	
	
	/**
	 * Returns the Human readable formatted size from the given number of Bytes. By default rounded to two decimals
	 * 
	 * @public
	 * @param {Number} a the input size in Bytes to be formatted
     * @param {Number} b the desired number of decimals to be used. Default: 2
	 * @return {String} the human readable formatted size
	 */
    static formatBytes(a,b=2){if(0===a)return"0 Bytes";const c=0>b?0:b,d=Math.floor(Math.log(a)/Math.log(1024));return parseFloat((a/Math.pow(1024,d)).toFixed(c))+" "+["Bytes","KB","MB","GB","TB","PB","EB","ZB","YB"][d]}
}

/**
 * ======================================================
 * BeepFileTransfer.FileWorker class definition
 * ======================================================
 */
'strict mode';
BeepFileTransfer.FileWorker = class {
	
	/**
	 * =============== Properties ===============
	 */

    /**
     * Indicates if the FileWorker is Reading a file. If false, it means that the FileWorker is configured for Writing
     */
    readMode = true;

    /**
     * the reference to the file to be read
     */
    _inputFile = null;

    /**
     * the referred file MIME type
     */
    inputFileType = null;

    /**
     * the referred file name
     */
    inputFileName = null;

    /**
     * the referred file size in Bytes
     */
    fileSize = 0;

    /**
     * the current byte count processed over the the toal number of fileSize
     */
    curBytes = 0;
	
	/**
     * Reader only: the last read byte from the source file
     */
	lastByte = null;
	
	/**
     * Writer only: the last received left hex number
     */
	lastLeftHex = null;
	
	/**
     * Writer only: the last received right hex number
     */
	lastRightHex = null;

    /**
     * For the readMode 'false' only, this is the in-memory array of Blob which contains the overall data cumulated up to now which can be downloaded on the disk when 
     * required.
     */
    _writerBuffer = [];

    _writerUrl = null;
	
	/**
     * For the readMode 'false' only, this array will contain Uint8Array values, which represent the json representation of the meta info object transmitted by the Sender machine
     * 
     */
	_metaInfoBufferArray = [];
	
	/**
	 * =============== Methods ===============
	 */
    
    /**
     * Creates and return a new instance of the FileWorker configured for READING from the given file
     * 
     * @public
     * @param {File} file the source file to be read
     * @return {BeepFileTransfer.FileWorker} the new instance of FileWorker configured as file reader
     */
    static createReader(file){
        let worker = new BeepFileTransfer.FileWorker();
        worker._inputFile = file;
        worker.inputFileType = file.type.trim().length == 0 ? "application/octet-stream" : file.type;
        worker.inputFileName = file.name;
        worker.fileSize = file.size;
        worker.readMode = true;
        return worker;
    }

    /**
     * Creates and return a new instance of the FileWorker configured for WRITING data to be downloaded as file on the running device
     * 
     * @public
     * @return {BeepFileTransfer.FileWorker} the new instance of FileWorker configured as file writer
     */
    static createWriter() {
        let worker = new BeepFileTransfer.FileWorker();
        worker.readMode = false;
        return worker;
    }

    /**
	 * Returns the meta information object of the referred file. 
     * It provides information like file name, MIME type, size in Bytes
	 * 
	 * @public
     * 
     * @return {Object} meta information object of the referred file.
	 */
    metaInfo() {
        let data = {};
        data["a"] = this.inputFileName;
        data["b"] = this.inputFileType;
        data["c"] = this.fileSize;
        return data;
    }

    /**
	 * Returns the percentage from 0.0 to 1.0 indicating the I/O progress on the referred file
	 * 
	 * @public
     * @return {Number} the percentage of the I/O progress.
	 */
    progress() { return (this.curBytes / this.fileSize); }

    /**
	 * Reads the next binary byte of the referred file if the FileWorker is configured for reading. 
     * If the last byte has been reached or no input file was provided, then 'lastByte' will contain 'null'
	 * 
	 * @public
	 * @return {number} the read byte
     * 
	 */
    async readNextByte() {
		let that = this;
		return new Promise(resolve => { 
			if (that.readMode == false) { resolve(null); return }
			if (that._inputFile === null || that.curBytes >= that.fileSize ) { 
				that.lastByte = null;
				resolve(null); return
			}
			let byteBlob = that._inputFile.slice(that.curBytes, that.curBytes + 1);
			const reader = new FileReader();
			reader.readAsDataURL(byteBlob);
			reader.onloadend = async () => { 
				let blobChunk = that._inputFile.slice(that.curBytes, that.curBytes + 1);
				let bytes = new Uint8Array(await blobChunk.arrayBuffer());
				if (bytes.length != 1) { resolve(null); return }
				that.lastByte = bytes[0];
				that.curBytes += 1;
				resolve(that.lastByte); 
			};
		});
    }

	/**
     * Collects the acquired hex number in order to build up the single byte from the sequence and ultimately write it in the _metaInfoBufferArray for determining 
	 * the meta info object, and retrieve the sender inputFileName, inputFileType, fileSize if the FileWorker is configured for writing.
     *
     * @public
	 * @param {number} hexNumber - The hexadecimal number which contributes to build up the receiving byte from the sequence
     */
	writerAcquireMetaInfo(hexNumber) {
        if (this.readMode == true) { return }
		// do not go further if the meta object has been already acquired
		if (this.inputFileName !== null) { return }
		if (this.lastLeftHex === null) {
			this.lastLeftHex = hexNumber;
		} else {
			this.lastRightHex = hexNumber;
		}
		// reduce the risk of recognizing unexpected beeps which translates in wrong chars, when is about the really first character of the json to be expected.
		// The meta info object as json will start with "{" which is the ASCII 123 or 0x7B. 
		// Therefore, if the lastLeftHex is different from 0x7 or lastRightHex is different from 0xB, then we can drop them all and attempt again
		if (this._metaInfoBufferArray.length === 0 && this.lastLeftHex != 0x7) { 
			this.lastLeftHex = null;
			return 
		}
		if (this._metaInfoBufferArray.length === 0 && this.lastRightHex !== null && this.lastRightHex != 0xB) { 
			this.lastLeftHex = null;
			this.lastRightHex = null;
			return 
		}
		if (this.lastLeftHex === null || this.lastRightHex === null) { return }
		
		let resultingByte = BeepFileTransfer.Utils._byteNumberFromLeftRightHex(this.lastLeftHex, this.lastRightHex);
		// reset the left/right hex as the byte has been built
		this.lastLeftHex = null;
		this.lastRightHex = null;
		
        // append the acquired byte to the meta info array
        this._metaInfoBufferArray.push(resultingByte);
		
		// check if the _metaInfoBufferArray string is a valid json, which would mean that the full json string has been acquired, and we are now ready to parse the metaInfo object received
		let metaInfoBufferString = String.fromCharCode(...this._metaInfoBufferArray);
		console.log("Meta info json string: " + metaInfoBufferString);
		try {
			let receivedMetaInfo = JSON.parse(metaInfoBufferString);
			this.inputFileName = receivedMetaInfo["a"];
			this.inputFileType = receivedMetaInfo["b"];
			this.fileSize = receivedMetaInfo["c"];
		} catch { }
    }

    /**
     * Collects the acquired hex number in order to build up the single byte from the sequence and ultimately write it in the buffer if the FileWorker is configured for writing.
     *
     * @public
	 * @param {number} hexNumber - The hexadecimal number which contributes to build up the receiving byte from the sequence
     */
    async writerCommitPendingByte(hexNumber) {
        if (this.readMode == true) { return }
		// do not go further if the meta info are missing
		if (this.inputFileName === null) { return }
		// do not proceed in case it reached the end of the file
		if (this.curBytes == this.fileSize) { return } 
		if (this.lastLeftHex === null) {
			this.lastLeftHex = hexNumber;
		} else {
			this.lastRightHex = hexNumber;
		}
		if (this.lastLeftHex === null || this.lastRightHex === null) { return }
		let resultingByte = BeepFileTransfer.Utils._byteNumberFromLeftRightHex(this.lastLeftHex, this.lastRightHex);
        // append the new blob chunk to the buffer
        this._writerBuffer.push(resultingByte);
        this.curBytes += 1;
		// reset the left/right hex as the byte has been built
		this.lastLeftHex = null;
		this.lastRightHex = null;
		// if all the bytes results to have been sent, then download the file on the disk
		if (this.curBytes == this.fileSize) {
			await this._writerDownloadFile();
		}
    }

    /**
     * Downloads the file
     * 
     * @public
     */
    async _writerDownloadFile() {
        let a = await this._writerCreateDownloadFile();
        document.body.appendChild(a);
        a.style = 'display: none';
        a.click();
        let that = this;
        setTimeout(() => {
          document.body.removeChild(a);
        }, 1);
    }

    /**
     * Creates the tag for downloading the buffer as file to the disk
     * 
     * @private
     */
    _writerCreateDownloadFile() {
        if (this.readMode == true) { return }
        if (this._writerBuffer === null) { return }
        let that = this;
        let prom = new Promise(resolve => { 
			let bytes = new Uint8Array(that._writerBuffer.length);
			for (var i = 0; i < that._writerBuffer.length; i++) { bytes[i] = that._writerBuffer[i]; }
            let resultingFileBlob = new Blob([bytes], {type : that.inputFileType});
            that._writerUrl = window.URL.createObjectURL(resultingFileBlob);
            let aTag = document.createElement("a");
            aTag.href = that._writerUrl;
            aTag.download = that.inputFileName;
            resolve(aTag); 
        });
        return prom;
    }
}

/**
 * ======================================================
 * BeepFileTransfer.BeepListener class definition
 * ======================================================
 */
'strict mode';
BeepFileTransfer.BeepListener = class {
	
	/**
	 * =============== Properties ===============
	 */
	
	/**
	 * The currently set web audio analyzer used to show the wave form of the generated beep from the sender
	 * @public
	 */
	analyzer = null;
	
	/**
	 * The audio context used to generate the beep sound from a given frequency
	 * @private
	 */
	_audioContext = null;

	/**
	 * The running audio stream from the microphone if any
	 * @private
	 */
	_audioStream = null;

	/**
	 * callback called at every frequency change detected, providing the detected frequency and the deducted hex number from it
	 * @private
	 */
	_onFrequencyDetected = null;
	
	/**
	 * The last detected frequency (Hertz)
	 * @private
	 */
	_lastDetectedFrequency = null;
	
	/**
	 * Indicates if the listener is running to detect frequencies or not
	 * @private
	 */
	_isRunning = false;
	
	/**
	 * =============== Methods ===============
	 */
	
	/**
     * Initializes the component
     * @public
	 * @return {boolean} true if the initialization succeded, false otherwise
     */
	async initialize(onFrequencyDetected) {
		this._audioContext = new AudioContext();
		try {
			// Connect the microphone
            this._audioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video:false });
			this._audioContext = new AudioContext();
			this.analyzer = this._audioContext.createAnalyser();
			let microphone = this._audioContext.createMediaStreamSource(this._audioStream);
			microphone.connect(this.analyzer);
			// Keep the callback for notifying the caller when a frequency gets detected
			this._onFrequencyDetected = onFrequencyDetected;
			return true;
        } catch(err) {
			this.close();
			return false; 
		}
	}
	
	/**
     * Closes the session and deinitialize his internal states (releasing audio context etc)
     * @public
     */
	close() {
		this._isRunning = false;
		this.analyzer = null;
		this._onFrequencyDetected = null;
		this._lastDetectedFrequency = null;
		if (this._audioContext !== null) {
			this._audioContext.close();
			this._audioContext = null;
		}
		if (this._audioStream !== null) {
			this._audioStream.getTracks().forEach(track => { track.stop(); });
			this._audioStream = null;
		}
	}
	
	/**
     * Start detecting frequencies
     * @public
     */
	start() {
		this._isRunning = true;
		this._run();
	}
	
	/**
     * Stops detecting frequencies
     * @public
     */
	stop() {
		this._isRunning = false;
	}
	
	/**
     * This method analyzes the sound and extract the frequency 
     * @private
     */
	_run() {
		if (this._isRunning == false ) { return }
		
		let data = new Uint8Array(this.analyzer.frequencyBinCount);
		this.analyzer.getByteFrequencyData(data);
		// get the laudest frequency
		let idx = 0;
		for (var j=0; j < this.analyzer.frequencyBinCount; j++) {
			if (data[j] > data[idx]) { idx = j; }
		}
		let newFrequency = idx * this._audioContext.sampleRate / this.analyzer.fftSize;
		let newHexNumber = BeepFileTransfer.Utils._hexNumberFromFrequency(newFrequency);
		// If the approximated hex number from the new frequency is different from the one of the previous frequency, then keep it and notify the callback
		if (BeepFileTransfer.Utils._hexNumberFromFrequency(this._lastDetectedFrequency) != newHexNumber) { 
			this._lastDetectedFrequency = newFrequency;
			// notify the callback with the new detected frequency
			if (this._onFrequencyDetected !== null) { this._onFrequencyDetected(this._lastDetectedFrequency, newHexNumber); }
		}

		let that = this;
		requestAnimationFrame(function() { that._run(); });
	}

}
