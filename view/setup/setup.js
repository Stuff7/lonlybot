'use strict'

const { ipcRenderer } = require("electron")

document.onreadystatechange = ()=> 
document.readyState=="interactive"&&(()=>{
	ipcRenderer.send("setup-ready",document.title)
	let channel = document.getElementById("setup-channel")
	let bot = document.getElementById("setup-bot")
	let autoconnect = document.getElementById("setup-autoconnect")
	let label = document.querySelector("p")

	let updateLabel = ()=> {
		label.innerText = autoconnect.checked&&"ON"||"OFF"
		label.style.color = autoconnect.checked&&"limegreen"||"orangered"
	}
	updateLabel()
	document.querySelector("form").onsubmit = ()=> {
		ipcRenderer.send("setup-done",
			channel.value,
			bot.value,
			autoconnect.checked,
		)
		return false
	}
	autoconnect.onchange = ()=> {
		updateLabel()
	}

	ipcRenderer.on("setup-ready",(e,_channel,_bot,_autoconnect)=> {
		channel.value = _channel
		bot.value = _bot
		autoconnect.checked = _autoconnect
		updateLabel()
	})
})()