//Import
function setupDragHandlers() {
	Blockbench.addDragHandler(
		'model',
		{extensions: Codec.getAllExtensions},
		function(files) {
			loadModelFile(files[0])
		}
	)
	Blockbench.addDragHandler(
		'style',
		{extensions: ['bbstyle', 'bbtheme']},
		function(files) {
			CustomTheme.import(files[0]);
		}
	)
	Blockbench.addDragHandler(
		'plugin',
		{extensions: ['bbplugin', 'js']},
		function(files) {
			new Plugin().loadFromFile(files[0], true)
		}
	)
	Blockbench.addDragHandler(
		'texture',
		{extensions: ['png', 'tga'], propagate: true, readtype: 'image'},
		function(files, event) {
			var texture_li = $(event.target).parents('li.texture')
			if (texture_li.length) {
				var tex = textures.findInArray('uuid', texture_li.attr('texid'))
				if (tex) {
					tex.fromFile(files[0])
					TickUpdates.selection = true;
					return;
				}
			}
			files.forEach(function(f) {
				new Texture().fromFile(f).add().fillParticle()
			})
		}
	)
}
var Extruder = {
	drawImage: function(file) {
		Extruder.canvas = $('#extrusion_canvas').get(0)
		var ctx = extrusion_canvas.getContext('2d')

		setProgressBar('extrusion_bar', 0)
		$('#scan_tolerance').on('input', function() {
			$('#scan_tolerance_label').text($(this).val())
		})
		showDialog('image_extruder')

		Extruder.ext_img = new Image()
		Extruder.ext_img.src = isApp ? file.path.replace(/#/g, '%23') : file.content
		Extruder.image_file = file
		Extruder.ext_img.style.imageRendering = 'pixelated'
		ctx.imageSmoothingEnabled = false;

		Extruder.ext_img.onload = function() {
			ctx.clearRect(0, 0, 256, 256);
			ctx.drawImage(Extruder.ext_img, 0, 0, 256, 256)
			Extruder.width = Extruder.ext_img.naturalWidth
			Extruder.height = Extruder.ext_img.naturalHeight

			if (Extruder.width > 128) return;

			var g = 256 / Extruder.width;
			var p = 0
			ctx.beginPath();

			for (var x = 0; x <= 256; x += g) {
				ctx.moveTo(0.5 + x + p, p);
				ctx.lineTo(0.5 + x + p, 256 + p);
			}
			for (var x = 0; x <= 256; x += g) {
				ctx.moveTo(p, 0.5 + x + p);
				ctx.lineTo(256 + p, 0.5 + x + p);
			}

			ctx.strokeStyle = "black";
			ctx.stroke();
		}

		//Grid
	},
	startConversion: function() {
		var scan_mode = $('select#scan_mode option:selected').attr('id') /*areas, lines, columns, pixels*/
		var isNewProject = elements.length === 0;

		var pixel_opacity_tolerance = parseInt($('#scan_tolerance').val())


		//Undo
		Undo.initEdit({elements: selected, outliner: true, textures: []})
		var texture = new Texture().fromFile(Extruder.image_file).add(false).fillParticle()

		//var ext_x, ext_y;
		var ctx = Painter.getCanvas(texture).getContext('2d')

		var c = document.createElement('canvas')
		var ctx = c.getContext('2d');
		c.width = Extruder.ext_img.naturalWidth;
		c.height = Extruder.ext_img.naturalHeight;
		ctx.drawImage(Extruder.ext_img, 0, 0)
		var image_data = ctx.getImageData(0, 0, c.width, c.height).data

		var finished_pixels = {}
		var cube_nr = 0;
		var cube_name = texture.name.split('.')[0]
		selected.empty()

		//Scale Index
		var scale_i = 1;
		if (Extruder.width < Extruder.height) {
			Extruder.width = Extruder.height;
		}
		scale_i = 16 / Extruder.width;

		function isOpaquePixel(px_x, px_y) {
			var opacity = image_data[(px_x + ctx.canvas.width * px_y) * 4 + 3]
			return Math.isBetween(px_x, 0, Extruder.width-1)
				&& Math.isBetween(px_y, 0, Extruder.height-1)
				&& opacity >= pixel_opacity_tolerance;
		}
		function finishPixel(x, y) {
			if (finished_pixels[x] === undefined) {
				finished_pixels[x] = {}
			}
			finished_pixels[x][y] = true
		}
		function isPixelFinished(x, y) {
			return (finished_pixels[x] !== undefined && finished_pixels[x][y] === true)
		}

		//Scanning
		let ext_y = 0;
		while (ext_y < Extruder.height) {

			let ext_x = 0;
			while (ext_x < Extruder.width) {
				if (isPixelFinished(ext_x, ext_y) === false && isOpaquePixel(ext_x, ext_y) === true) {

					//Search From New Pixel
					var loop = true;
					var rect = {x: ext_x, y: ext_y, x2: ext_x, y2: ext_y}
					var safety_limit = 5000

					//Expanding Loop
					while (loop === true && safety_limit) {
						var y_check, x_check, canExpandX, canExpandY;
						//Expand X
						if (scan_mode === 'areas' || scan_mode === 'lines') {
							y_check = rect.y
							x_check = rect.x2 + 1
							canExpandX = true
							while (y_check <= rect.y2) {
								//Check If Row is Free
								if (isOpaquePixel(x_check, y_check) === false || isPixelFinished(x_check, y_check) === true) {
									canExpandX = false;
								}
								y_check += 1
							}
							if (canExpandX === true) {
								rect.x2 += 1
							}
						} else {
							canExpandX = false;
						}
						//Expand Y
						if (scan_mode === 'areas' || scan_mode === 'columns') {
							x_check = rect.x
							y_check = rect.y2 + 1
							canExpandY = true
							while (x_check <= rect.x2) {
								//Check If Row is Free
								if (isOpaquePixel(x_check, y_check) === false || isPixelFinished(x_check, y_check) === true) {
									canExpandY = false
								}
								x_check += 1
							}
							if (canExpandY === true) {
								rect.y2 += 1
							}
						} else {
							canExpandY = false;
						}
						//Conclusion
						if (canExpandX === false && canExpandY === false) {
							loop = false;
						}
						safety_limit--;
					}

					//Draw Rectangle
					var draw_x = rect.x
					var draw_y = rect.y
					while (draw_y <= rect.y2) {
						draw_x = rect.x
						while (draw_x <= rect.x2) {
							finishPixel(draw_x, draw_y)
							draw_x++;
						}
						draw_y++;
					}
					var current_cube = new Cube({
						name: cube_name+'_'+cube_nr,
						autouv: 0,
						from: [rect.x*scale_i, 0, rect.y*scale_i],
						to: [(rect.x2+1)*scale_i, scale_i, (rect.y2+1)*scale_i],
						faces: {
							up:		{uv:[rect.x*scale_i, rect.y*scale_i, (rect.x2+1)*scale_i, (rect.y2+1)*scale_i], texture: texture},
							down:	{uv:[rect.x*scale_i, (rect.y2+1)*scale_i, (rect.x2+1)*scale_i, rect.y*scale_i], texture: texture},
							north:	{uv:[(rect.x2+1)*scale_i, rect.y*scale_i, rect.x*scale_i, (rect.y+1)*scale_i], texture: texture},
							south:	{uv:[rect.x*scale_i, rect.y2*scale_i, (rect.x2+1)*scale_i, (rect.y2+1)*scale_i], texture: texture},
							east:	{uv:[rect.x2*scale_i, rect.y*scale_i, (rect.x2+1)*scale_i, (rect.y2+1)*scale_i], texture: texture, rotation: 90},
							west:	{uv:[rect.x*scale_i, rect.y*scale_i, (rect.x+1)*scale_i, (rect.y2+1)*scale_i], texture: texture, rotation: 270},
						}
					}).init()
					selected.push(current_cube)
					cube_nr++;
				}

				ext_x++;
			}
			ext_y++;
		}

		var group = new Group(cube_name).init().addTo()
		selected.forEach(function(s) {
			s.addTo(group).init()
		})

		Undo.finishEdit('add extruded texture', {elements: selected, outliner: true, textures: [textures[textures.length-1]]})

		hideDialog()
	}
}
//Export
function uploadSketchfabModel() {
	if (elements.length === 0) {
		return;
	}
	var dialog = new Dialog({
		id: 'sketchfab_uploader',
		title: 'dialog.sketchfab_uploader.title',
		width: 540,
		form: {
			token: {label: 'dialog.sketchfab_uploader.token', value: settings.sketchfab_token.value, type: 'password'},
			about_token: {type: 'info', text: tl('dialog.sketchfab_uploader.about_token', ['[sketchfab.com/settings/password](https://sketchfab.com/settings/password)'])},
			name: {label: 'dialog.sketchfab_uploader.name'},
			description: {label: 'dialog.sketchfab_uploader.description', type: 'textarea'},
			tags: {label: 'dialog.sketchfab_uploader.tags', placeholder: 'Tag1 Tag2'},
			animations: {label: 'dialog.sketchfab_uploader.animations', value: true, type: 'checkbox', condition: (Format.animation_mode && Animator.animations.length)},
			//color: {type: 'color', label: 'dialog.sketchfab_uploader.color'},
			draft: {label: 'dialog.sketchfab_uploader.draft', type: 'checkbox'},
			// Category
			divider: '_',
			private: {label: 'dialog.sketchfab_uploader.private', type: 'checkbox'},
			password: {label: 'dialog.sketchfab_uploader.password'},
		},
		onConfirm: function(formResult) {

			if (formResult.token && !formResult.name) {
				Blockbench.showQuickMessage('message.sketchfab.name_or_token', 1800)
				return;
			}
			if (!formResult.tags.split(' ').includes('blockbench')) {
				formResult.tags += ' blockbench';
			}
			var data = new FormData()
			data.append('token', formResult.token)
			data.append('name', formResult.name)
			data.append('description', formResult.description)
			data.append('tags', formResult.tags)
			data.append('isPublished', !formResult.draft)
			//data.append('background', JSON.stringify({color: formResult.color.toHexString()}))
			data.append('private', formResult.private)
			data.append('password', formResult.password)
			data.append('source', 'blockbench')

			settings.sketchfab_token.value = formResult.token

			Codecs.gltf.compile({animations: formResult.animations}, (content) => {

				var blob = new Blob([content], {type: "text/plain;charset=utf-8"});
				var file = new File([blob], 'model.gltf')

				data.append('modelFile', file)

				$.ajax({
					url: 'https://api.sketchfab.com/v3/models',
					data: data,
					cache: false,
					contentType: false,
					processData: false,
					type: 'POST',
					success: function(response) {
						Blockbench.showMessageBox({
							title: tl('message.sketchfab.success'),
							message:
								`[${formResult.name} on Sketchfab](https://sketchfab.com/models/${response.uid})`, //\n\n&nbsp;\n\n`+
								//tl('message.sketchfab.setup_guide', '[Sketchfab Setup and Common Issues](https://blockbench.net/2020/01/22/sketchfab-setup-and-common-issues/)'),
							icon: 'icon-sketchfab',
						})
					},
					error: function(response) {
						Blockbench.showQuickMessage('message.sketchfab.error', 1500)
						console.error(response);
					}
				})
			})

			dialog.hide()
		}
	})
	dialog.show()
}
//Json
function compileJSON(object, options) {
	if (typeof options !== 'object') options = {}
	function newLine(tabs) {
		if (options.small === true) {return '';}
		var s = '\n'
		for (var i = 0; i < tabs; i++) {
			s += '\t'
		}
		return s;
	}
	function escape(string) {
		return string.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n|\r\n/g, '\\n').replace(/\t/g, '\\t')
	}
	function handleVar(o, tabs) {
		var out = ''
		if (typeof o === 'string') {
			//String
			out += '"' + escape(o) + '"'
		} else if (typeof o === 'boolean') {
			//Boolean
			out += (o ? 'true' : 'false')
		} else if (o === null || o === Infinity || o === -Infinity) {
			//Null
			out += 'null'
		} else if (typeof o === 'number') {
			//Number
			o = (Math.round(o*100000)/100000).toString()
			out += o
		} else if (typeof o === 'object' && o instanceof Array) {
			//Array
			var has_content = false
			out += '['
			for (var i = 0; i < o.length; i++) {
				var compiled = handleVar(o[i], tabs+1)
				if (compiled) {
					var breaks = typeof o[i] === 'object'
					if (has_content) {out += ',' + (breaks || options.small?'':' ')}
					if (breaks) {out += newLine(tabs)}
					out += compiled
					has_content = true
				}
			}
			if (typeof o[o.length-1] === 'object') {out += newLine(tabs-1)}
			out += ']'
		} else if (typeof o === 'object') {
			//Object
			var breaks = o.constructor.name !== 'oneLiner';
			var has_content = false
			out += '{'
			for (var key in o) {
				if (o.hasOwnProperty(key)) {
					var compiled = handleVar(o[key], tabs+1)
					if (compiled) {
						if (has_content) {out += ',' + (breaks || options.small?'':' ')}
						if (breaks) {out += newLine(tabs)}
						out += '"' + escape(key) + '":' + (options.small === true ? '' : ' ')
						out += compiled
						has_content = true
					}
				}
			}
			if (breaks && has_content) {out += newLine(tabs-1)}
			out += '}'
		}
		return out;
	}
	return handleVar(object, 1)
}
function autoParseJSON(data, feedback) {
	if (data.substr(0, 4) === '<lz>') {
		data = LZUTF8.decompress(data.substr(4), {inputEncoding: 'StorageBinaryString'})
	}
	if (data.charCodeAt(0) === 0xFEFF) {
		data = data.substr(1)
	}
	try {
		data = JSON.parse(data)
	} catch (err1) {
		data = data.replace(/\/\*[^(\*\/)]*\*\/|\/\/.*/g, '')
		try {
			data = JSON.parse(data)
		} catch (err) {
			if (feedback === false) return;
			function logErrantPart(whole, start, length) {
				var line = whole.substr(0, start).match(/\n/gm)
				line = line ? line.length+1 : 1
				var result = '';
				var lines = whole.substr(start, length).split(/\n/gm)
				lines.forEach((s, i) => {
					result += `#${line+i} ${s}\n`
				})
				console.log(result.substr(0, result.length-1) + ' <-- HERE')
			}
			console.error(err)
			var length = err.toString().split('at position ')[1]
			if (length) {
				length = parseInt(length)
				var start = limitNumber(length-20, 0, Infinity)

				logErrantPart(data, start, 1+length-start)
			} else if (err.toString().includes('Unexpected end of JSON input')) {

				logErrantPart(data, data.length-10, 10)
			}
			Blockbench.showMessageBox({
				translateKey: 'invalid_file',
				icon: 'error',
				message: tl('message.invalid_file.message', [err])
			})
			return;
		}
	}
	return data;
}


BARS.defineActions(function() {
	//Import
	new Action('open_model', {
		icon: 'assessment',
		category: 'file',
		keybind: new Keybind({key: 'o', ctrl: true}),
		condition: () => (!EditSession.active || EditSession.hosting),
		click: function () {
			var startpath;
			if (isApp && recent_projects && recent_projects.length) {
				startpath = recent_projects[0].path;
				if (typeof startpath == 'string') {
					startpath = startpath.split(osfs);
					startpath.pop();
					startpath = startpath.join(osfs);
				}
			}
			Blockbench.import({
				resource_id: 'model',
				extensions: Codec.getAllExtensions(),
				type: 'Model',
				startpath
			}, function(files) {
				loadModelFile(files[0]);
			})
		}
	})
	new Action('extrude_texture', {
		icon: 'eject',
		category: 'file',
		condition: _ => !Project.box_uv,
		click: function () {
			Blockbench.import({
				resource_id: 'texture',
				extensions: ['png'],
				type: 'PNG Texture',
				readtype: 'image'
			}, function(files) {
				if (files.length) {
					showDialog('image_extruder')
					Extruder.drawImage(files[0])
				}
			})
		}
	})
	//Export
	new Action('export_over', {
		icon: 'save',
		category: 'file',
		keybind: new Keybind({key: 's', ctrl: true}),
		click: function () {
			if (isApp) {
				saveTextures()
				if (Format) {
					if (Project.export_path && Format.codec && Format.codec.compile) {
						Format.codec.write(Format.codec.compile(), Project.export_path)
					} else if (Project.save_path) {
						Codecs.project.write(Codecs.project.compile(), Project.save_path);
					} else if (Format.codec && Format.codec.export) {
						Format.codec.export()
					}
				}
				if (Format.animation_mode && Format.animation_files && Animation.all.length) {
					BarItems.save_all_animations.trigger();
				}
			} else {
				saveTextures()
				if (Format.codec && Format.codec.export) {
					Format.codec.export()
				}
			}
		}
	})
	if (!isApp) {
		new Action('export_asset_archive', {
			icon: 'archive',
			category: 'file',
			condition: _ => Format && Format.codec,
			click: function() {
				var archive = new JSZip();
				var content = Format.codec.compile()
				var name = `${Format.codec.fileName()}.${Format.codec.extension}`
				archive.file(name, content)
				textures.forEach(tex => {
					if (tex.mode === 'bitmap') {
						archive.file(pathToName(tex.name) + '.png', tex.source.replace('data:image/png;base64,', ''), {base64: true});
					}
				})
				archive.generateAsync({type: 'blob'}).then(content => {
					Blockbench.export({
						type: 'Zip Archive',
						extensions: ['zip'],
						name: 'assets',
						startpath: Project.export_path,
						content: content,
						savetype: 'zip'
					})
					Project.saved = true;
				})
			}
		})
	}
	new Action('upload_sketchfab', {
		icon: 'icon-sketchfab',
		category: 'file',
		click: function(ev) {
			uploadSketchfabModel()
		}
	})


	new Action('share_model', {
		icon: 'share',
		condition: () => Cube.all.length,
		click() {
			var dialog = new Dialog({
				id: 'share_model',
				title: 'dialog.share_model.title',
				form: {
					expire_time: {label: 'dialog.share_model.expire_time', type: 'select', default: '2d', options: {
						'10m': tl('dates.minutes', [10]),
						'1h': tl('dates.hour', [1]),
						'1d': tl('dates.day', [1]),
						'2d': tl('dates.days', [2]),
						'1w': tl('dates.week', [1]),
						'2w': tl('dates.weeks', [2]),
					}},
					info: {type: 'info', text: 'The model will be stored on the Blockbench servers for the duration specified above. [Learn more](https://blockbench.net/blockbench-model-sharing-service/)'}
				},
				buttons: ['generic.share', 'dialog.cancel'],
				onConfirm: function(formResult) {
		
					let expire_time = formResult.expire_time;
					let model = Codecs.project.compile({compressed: false});

					$.ajax({
						url: 'https://blckbn.ch/api/model',
						data: JSON.stringify({ expire_time, model }),
						cache: false,
						contentType: 'application/json; charset=utf-8',
						dataType: 'json',
						type: 'POST',
						success: function(response) {
							let link = `https://blckbn.ch/${response.id}`

							let link_dialog = new Dialog({
								id: 'share_model_link',
								title: 'dialog.share_model.title',
								form: {
									link: {type: 'text', value: link}
								},
								buttons: ['action.copy', 'dialog.close'],
								onConfirm() {
									link_dialog.hide();
									if (isApp || navigator.clipboard) {
										Clipbench.setText(link);
										Blockbench.showQuickMessage('dialog.share_model.copied_to_clipboard');
									} else {
										Blockbench.showMessageBox({
											title: 'dialog.share_model.title',
											message: `[${link}](${link})`,
										})
									}
								}
							}).show();

						},
						error: function(response) {
							Blockbench.showQuickMessage('dialog.share_model.failed', 1500)
							console.error(response);
						}
					})
		
					dialog.hide()
				}
			})
			dialog.show()
		}
	})



})
