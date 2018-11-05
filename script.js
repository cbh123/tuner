

self.onmessage = function(event)
{
	var timeseries = event.data.timeseries;
	var test_frequencies = event.data.test_frequencies;
	var sample_rate = event.data.sample_rate;
	var amplitudes = compute_correlations(timeseries, test_frequencies, sample_rate);
	self.postMessage({ "timeseries": timeseries, "frequency_amplitudes": amplitudes });
};



// Define the set of test frequencies that we'll use to analyze microphone data.
var C2 = 65.41; // C2 note, in Hz.
var notes = [ "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B" ];
var test_frequencies = [];
for (var i = 0; i < 30; i++) {
	var note_frequency = C2 * Math.pow(2, i / 12);
	var note_name = notes[i % 12];
	var note_adjustment = 0;
	var note = { "frequency": note_frequency, "name": note_name };
	var just_above = { "frequency": note_frequency * Math.pow(2, 1 / 48), "name": note_name, "adjustment:" : " (a bit sharp)" };
	var just_below = { "frequency": note_frequency * Math.pow(2, -1 / 48), "name": note_name, "adjustment:" : " (a bit sharp)"  };
	test_frequencies = test_frequencies.concat([ just_below, note, just_above ]);
}

window.addEventListener("load", initialize);
var correlation_worker = new Worker("script.js");
correlation_worker.addEventListener("message", interpret_correlation_result);
function initialize() {
	var get_user_media = navigator.getUserMedia;
	get_user_media = get_user_media || navigator.webkitGetUserMedia;
	get_user_media = get_user_media || navigator.mozGetUserMedia;
	get_user_media.call(navigator, { "audio": true }, use_stream, function() {});
//	document.getElementById("play-note").addEventListener("click", toggle_playing_note);
}

function use_stream(stream) {
	var audio_context = new AudioContext();
	var microphone = audio_context.createMediaStreamSource(stream);
	window.source = microphone; // Workaround for https://bugzilla.mozilla.org/show_bug.cgi?id=934512
	var script_processor = audio_context.createScriptProcessor(1024, 1, 1);
	script_processor.connect(audio_context.destination);
	microphone.connect(script_processor);
	var buffer = [];
	var sample_length_milliseconds = 100;
	var recording = true;
	// Need to leak this function into the global namespace so it doesn't get
	// prematurely garbage-collected.
	// http://lists.w3.org/Archives/Public/public-audio/2013JanMar/0304.html
	window.capture_audio = function(event)
	{
		if (!recording)
			return;
		buffer = buffer.concat(Array.prototype.slice.call(event.inputBuffer.getChannelData(0)));
		// Stop recording after sample_length_milliseconds.
		if (buffer.length > sample_length_milliseconds * audio_context.sampleRate / 1000)
		{
			recording = false;
			correlation_worker.postMessage
			(
				{
					"timeseries": buffer,
					"test_frequencies": test_frequencies,
					"sample_rate": audio_context.sampleRate
				}
			);
			buffer = [];
			setTimeout(function() { recording = true; }, 250);
		}
	};
	script_processor.onaudioprocess = window.capture_audio;
}
function interpret_correlation_result(event)
{
	var timeseries = event.data.timeseries;
	var frequency_amplitudes = event.data.frequency_amplitudes;
	// Compute the (squared) magnitudes of the complex amplitudes for each
	// test frequency.
	var magnitudes = frequency_amplitudes.map(function(z) { return z[0] * z[0] + z[1] * z[1]; });
	// Find the maximum in the list of magnitudes.
	var maximum_index = -1;
	var maximum_magnitude = 0;
	for (var i = 0; i < magnitudes.length; i++)
	{
		if (magnitudes[i] <= maximum_magnitude)
			continue;
		maximum_index = i;
		maximum_magnitude = magnitudes[i];
	}
	// Compute the average magnitude. We'll only pay attention to frequencies
	// with magnitudes significantly above average.
	var average = magnitudes.reduce(function(a, b) { return a + b; }, 0) / magnitudes.length;
	var confidence = maximum_magnitude / average;
	var confidence_threshold = 25; // empirical, arbitrary.
	if (confidence > confidence_threshold)
	{
		var dominant_frequency = test_frequencies[maximum_index];
        console.log(dominant_frequency.name)
        document.getElementById("note-name").textContent = dominant_frequency.name;
				// document.getElementById("note-adjustment").textContent = dominant_frequency.adjustment;
        document.getElementById("note-frequency").textContent = Math.round(dominant_frequency.frequency) + " Hz";



	}


}


// Unnecessary addition of button to play an E note.
//var note_context = new AudioContext();
//var note_node = note_context.createOscillator();
//var gain_node = note_context.createGain();
//note_node.frequency = C2 * Math.pow(2, 4 / 12); // E, ~82.41 Hz.
//gain_node.gain.value = 0;
//note_node.connect(gain_node);
//gain_node.connect(note_context.destination);
//note_node.start();
//var playing = false;
//
//function toggle_playing_e() {
//	playing = !playing;
//	if (playing)
//		gain_node.gain.value = 0.1;
//	else
//		gain_node.gain.value = 0;
//}

// Unnecessary addition of button to play an A note.
var note_context = new AudioContext();
var note_node = note_context.createOscillator();
var gain_node = note_context.createGain();
note_node.frequency = C2 * Math.pow(3,2/12);  // E, ~82.41 Hz.
console.log(note_node.frequency)
gain_node.gain.value = 0;
note_node.connect(gain_node);
gain_node.connect(note_context.destination);
note_node.start();
var playing = false;

function toggle_playing_a() {
	playing = !playing;
	if (playing)
		gain_node.gain.value = 0.1;
	else
		gain_node.gain.value = 0;
}

function compute_correlations(timeseries, test_frequencies, sample_rate)
{
	// 2pi * frequency gives the appropriate period to sine.
	// timeseries index / sample_rate gives the appropriate time coordinate.
	var scale_factor = 2 * Math.PI / sample_rate;
	var amplitudes = test_frequencies.map
	(
		function(f)
		{
			var frequency = f.frequency;

			// Represent a complex number as a length-2 array [ real, imaginary ].
			var accumulator = [ 0, 0 ];
			for (var t = 0; t < timeseries.length; t++)
			{
				accumulator[0] += timeseries[t] * Math.cos(scale_factor * frequency * t);
				accumulator[1] += timeseries[t] * Math.sin(scale_factor * frequency * t);
			}

			return accumulator;
		}
	);

	return amplitudes;
}

// var canvas = document.getElementById("myDial");
// var ctx = canvas.getContext("2d");
// ctx.fillStyle = "#FF0000";
// ctx.fillRect();
