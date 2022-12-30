# BeepFileTransfer
This tool allows you to transmit files between two devices relying <b>EXCLUSIVELY</b> on the sound, speaker to microphone. Therefore the two devices can work both offline, regardless of the platform and the hardware configuration, as long as the sender device has working speakers, and the receiver a working microphone</br>
<b>Preconiditions:</b>
<ul>
	<li>Sender has a working speaker</li>
	<li>Receiver has a working microphone</li>
	<li>The two devices are pretty close (but not completely attached each other), so that the sound can be properly detected by the receiver for the data processing</li>
</ul>
<b>Recommendations:</b>
<ul>
	<li>The distance between the two devices is pretty close</li>
	<li>The room / place where the two device are located is the most silent possible</li>
	<li>The two devices are fixed while the transmission is ongoning (better not to cause noise while running, in order to avoid unexpected data transmission which may corrupt the file)</li>
</ul>
<b>How to use:</b> 
<ul>
	<li>The Receiver device starts the session from "Receive file"</li>
	<li>The Receiver device presses on "Start receiving" and allows the microphone permission asked by the browser</li>
	<li>The Sender device starts the session from "Send file" and picks the file which is intended to be transmitted to the Receiver device</li>
	<li>The Sender device presses directly on "Start sending" </li>
</ul>
<b>How does it work:</b> 
<ul>
	<li>The entire tool relies on the natively provided <a href="https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API">Web Audio API</a></li>
	<li>It generates beep sounds (Sender) and analyzes and determines the frequency of that sound (Receiver)</a></li>
	<li>We define a sound frequency spectre and we quantize it to be able to represent all the values of a single hexadecimal number (0x0 -> 0xF)</li>
	<li>Each quantum is a frequency range representing a single value in hexadecimal</li>
	<li>The list below represent the mapping of the hex value and the representing frequency range: <ul id="helpHexFreqMapId"></ul></li>
	<li>Each Byte (0x00 -> 0xFF) in the file stream, is locally split in two parts. This allows us to represent the each part with a dedicated beep. Therefore, each Byte is "logically" represented by two beeps. In order to help the Receiver audio analysis, we place a "separator" beep between the two part and one after the second part. As final result, each Byte is actually represented by 4 beeps</li>
	<li>The Sender start with a "separator" beep to awake/normalize the Receiver microphone, and also to inform you that the transmission is about to start.</li>
	<li>After the initial beep it will start sending the sequence of beeps to build up the meta info object (as json string). Those meta info are file name, file size, file type</li>
	<li>Once the meta info beep sequence is sent, it will perform another "separator" beep, which indicates that the actual file transmission in beeps, is about to start</li>
	<li>The Receiver, who hopefully managed to receive and detect a valid json sequence of caracter, will parse it and receive file name, file type and file size. The file size will be used to determine the end of the file transmission on the Receiver side</li>
	<li>The file data transmission (Byte after Byte till the end) will run by performing the beeps, until the end of the file. As you can imagine, this process is overall pretty long, and error prone, given the nature of the solution adopted (sounds) to transmit information from Sender to Receiver</li>
	<li>Once the Receiver gets the last expected Byte, it will wrap it up and download it on the disk</li>
</ul>
<b>Extra notes:</b> 
<ul>
	<li>The configuration adopted at the moment is the one that fit my tests, with the lowest error rate. Fell free to play around by changing the parameters in the class "BeepFileTransfer.Utils", such as:
		<ul>
			<li>minFrequency</li>
			<li>maxFrequency</li>
			<li>separatorFrequency</li>
			<li>defaultOscillatorType</li>
			<li>defaultBeepDuration</li>
			<li>defaultBeepVolume</li>
			<li>defaultUseSeparator</li>
		</ul>
	</li>
	<li>If you use an iPhone as Sender device, make sure that the phone is not in Silent mode in order to successfully perform the beeps sounds</li>
</ul>
<b>Dependencies:</b> 
<ul>
	<li>This tool is written using Vanilla Javascript, HTML and CSS, with NO third party libraries</li>
</ul>
