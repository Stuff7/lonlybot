'use strict'

const { ipcRenderer } = require("electron")

document.onreadystatechange = ()=> 
document.readyState=="interactive"&&(()=> {
	ipcRenderer.send("settings-ready")
	let back = document.getElementById("back")
	let editorName = document.getElementById("editor-name")
	let add = document.getElementById("editor-add")
	let list = document.querySelector("ul")
	let defCmds = {
		timer: document.getElementById("timer-cmd"),
		intvl: document.getElementById("intvl-cmd"),
	}

	const addEditor = (id,name)=> {
		let editor = document.createElement("li")
		let input = document.createElement("input")
		let button = document.createElement("button")
		input.value = name
		input.autocomplete = "off"
		button.innerText = "x"
	
		button.onclick = ()=> {
			ipcRenderer.send("del-editor",id)
			list.removeChild(editor)
		}
	
		input.onchange = ()=> {
			ipcRenderer.send("edit-editor",id,input.value)
		}
	
		editor.appendChild(input)
		editor.appendChild(button)
		list.appendChild(editor)
	}
	const upd_editors = ids=> {
		fetch(`https://api.twitch.tv/helix/users?${ids}`,
			{headers:{"Client-ID":"zlhbuxnvm01fbq3h0xr8o602lfhln0"}})
			.then(re=>re.status==200&&re.json()).then(json=>{
				json.data.forEach(user=> addEditor(user.id, user.display_name))
			})
	}

	back.onclick = ()=> {
		ipcRenderer.send("settings-back")
	}
	add.onclick = ()=> {
		ipcRenderer.send("add-editor",editorName.value)
	}
	Object.keys(defCmds).forEach(cmd=> {
		defCmds[cmd].onchange = ()=> ipcRenderer.send("def-cmd",cmd,defCmds[cmd].value)
	})

	ipcRenderer.on("settings-ready",(ev,ids,cmds)=> {
		upd_editors(ids)
		Object.keys(defCmds).forEach(cmd=> {defCmds[cmd].value = cmds[cmd]})
	})
	ipcRenderer.on("add-editor",(ev,id,name)=> addEditor(id, name))
})()