'use strict'

const { ipcRenderer } = require("electron")

document.onreadystatechange = ()=> 
document.readyState=="interactive"&&(()=> {
	ipcRenderer.send("timers-ready",document.title)
	let status = document.querySelector("p")
	let slider = document.getElementById("timer-intvl")
	let list = document.querySelector("ul")
	let name = document.getElementById("timer-name")
	let resp = document.getElementById("timer-resp")
	let disconnect = document.getElementById("disconnect")
	let settings = document.getElementById("settings")
	let run = document.getElementById("timers-run")
	let runlabel = document.querySelector("[for=timers-run]")

	const addTimers = timers=> {
		list.innerHTML = Object.keys(timers).reduce((html,name)=>
			html += "<li><div>"+
								`<textarea autocomplete = "off">${name}</textarea>`+
							"</div><div>"+
								`<textarea autocomplete = "off">${timers[name]}</textarea>`+
							"</div><div><button>x</button></div></li>","")

		Object.values(list.children).forEach((timer,i)=> {
			timer.querySelector("button").onclick = ()=> {
				ipcRenderer.send("del-timer",timer.querySelector("textarea").value)
				list.removeChild(timer)
			}
			let [name, response] = timer.querySelectorAll("textarea")
			response.onchange = ()=> {
				ipcRenderer.send("timer-resp-edit",name.value,response.value)
			}
			name.onchange = ()=> {
				ipcRenderer.send("timer-name-edit",name.value,Object.keys(timers)[i])
			}
			timer.onclick = ()=> response.oninput()||name.oninput()
		})
		addAutoResize()
	}

	const setIntvlLabel = ()=> 
	status.innerText = `Send every ${
		!slider.valueAsNumber&&"2 seconds"||
		slider.valueAsNumber==1&&"minute"||
		`${slider.valueAsNumber} minutes`}`
	const setRunLabel = ()=> runlabel.innerText = run.checked&&"STOP"||"RUN"
	const setIntvl = intvl=> {
		slider.value = intvl
		setIntvlLabel()
	}
	const setRun = v=> {
		run.checked = v
		setRunLabel()
	}
	
	slider.oninput = ()=> {
		setIntvlLabel()
	}
	slider.onchange = ()=> {
		ipcRenderer.send("timers-input",slider.valueAsNumber)
	}
	document.querySelector("form").onsubmit = ()=> {
		ipcRenderer.send("add-timer",name.value,resp.value)
		name.value = resp.value = ""
		return false
	}
	disconnect.onclick = ()=> {
		ipcRenderer.send("disconnect")
	}
	settings.onclick = ()=> {
		ipcRenderer.send("settings")
	}
	run.onchange = ()=> {
		setRunLabel()
		ipcRenderer.send("run-timers",run.checked)
	}

	ipcRenderer.on("timers-ready",(ev,bot,timers,intvl,runTimers)=> {
		addAutoResize()
		document.title = bot
		setIntvl(intvl)
		setRun(runTimers)
		addTimers(timers)
	})
	ipcRenderer.on("timer-added",(ev,timers)=> addTimers(timers))
	ipcRenderer.on("intvl-upd",(ev,intvl)=> setIntvl(intvl))
})()

function addAutoResize() {
	document.querySelectorAll("textarea").forEach(element=> {
		const resize = ()=> {
			element.style.height = "auto"
			element.style.height = `${element.scrollHeight+4}px`
		}
		(element.oninput = resize)()
	})
}