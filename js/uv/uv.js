import { PointerTarget } from "../interface/pointer_target";
import UVEditorPanel from "./UVEditor.vue"

// Image manipulation helpers for UV+texture transforms
function flipImageDataH(imageData) {
	const { width, height, data } = imageData;
	const flipped = new ImageData(width, height);
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const srcIdx = (y * width + x) * 4;
			const dstIdx = (y * width + (width - 1 - x)) * 4;
			flipped.data[dstIdx] = data[srcIdx];
			flipped.data[dstIdx + 1] = data[srcIdx + 1];
			flipped.data[dstIdx + 2] = data[srcIdx + 2];
			flipped.data[dstIdx + 3] = data[srcIdx + 3];
		}
	}
	return flipped;
}

function flipImageDataV(imageData) {
	const { width, height, data } = imageData;
	const flipped = new ImageData(width, height);
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const srcIdx = (y * width + x) * 4;
			const dstIdx = ((height - 1 - y) * width + x) * 4;
			flipped.data[dstIdx] = data[srcIdx];
			flipped.data[dstIdx + 1] = data[srcIdx + 1];
			flipped.data[dstIdx + 2] = data[srcIdx + 2];
			flipped.data[dstIdx + 3] = data[srcIdx + 3];
		}
	}
	return flipped;
}

function rotateImageDataCW(imageData) {
	const { width, height, data } = imageData;
	const rotated = new ImageData(height, width);
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const srcIdx = (y * width + x) * 4;
			const dstX = height - 1 - y;
			const dstY = x;
			const dstIdx = (dstY * height + dstX) * 4;
			rotated.data[dstIdx] = data[srcIdx];
			rotated.data[dstIdx + 1] = data[srcIdx + 1];
			rotated.data[dstIdx + 2] = data[srcIdx + 2];
			rotated.data[dstIdx + 3] = data[srcIdx + 3];
		}
	}
	return rotated;
}

function rotateImageDataCCW(imageData) {
	const { width, height, data } = imageData;
	const rotated = new ImageData(height, width);
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const srcIdx = (y * width + x) * 4;
			const dstX = y;
			const dstY = width - 1 - x;
			const dstIdx = (dstY * height + dstX) * 4;
			rotated.data[dstIdx] = data[srcIdx];
			rotated.data[dstIdx + 1] = data[srcIdx + 1];
			rotated.data[dstIdx + 2] = data[srcIdx + 2];
			rotated.data[dstIdx + 3] = data[srcIdx + 3];
		}
	}
	return rotated;
}

// Rotates ImageData to match UV rotation
function rotateImageDataByDegrees(imageData, degrees) {
	switch ((degrees + 360) % 360) {
		case 0:   return imageData;
		case 90:  return rotateImageDataCCW(imageData);
		case 180: return rotateImageDataCW(rotateImageDataCW(imageData));
		case 270: return rotateImageDataCW(imageData);
		default:  return imageData;
	}
}


export const UVEditor = {
	face: 'north',
	size: 320,
	grid: 1,
	auto_grid: true,
	panel: null,
	sliders: {},
	selected_element_faces: {},
	previous_animation_frame: 1,
	overlay_canvas: (() => {
		let canvas = document.createElement('canvas');
		canvas.classList.add('overlay_canvas');
		return canvas;
	})(),

	get vue() {
		return this.panel.inside_vue;
	},
	message(msg, vars) {
		msg = tl(msg, vars)
		let box = document.createElement('div');
		box.className = 'uv_message_box'
		box.textContent = msg;
		this.vue.$refs.main.append(box)
		setTimeout(function() {
			box.remove()
		}, 1200)
	},
	//Brush
	getBrushCoordinates(event, tex) {
		convertTouchEvent(event);
		let pixel_size = this.inner_width / (tex ? tex.width : Project.texture_width);
		let result = {};
		let mouse_coords;
		if (event.target.id == 'uv_frame') {
			mouse_coords = [event.offsetX, event.offsetY];
		} else {
			let frame_pos = $('#uv_frame').offset();
			mouse_coords = [
				event.clientX - frame_pos.left,
				event.clientY - frame_pos.top
			];
		}

		if (Toolbox.selected.id === 'selection_tool') {
			if (BarItems.selection_tool.mode == 'lasso') {
				result.x = mouse_coords[0]/pixel_size;
				result.y = mouse_coords[1]/pixel_size;
			} else if (settings.nearest_rectangle_select.value) {
				result.x = Math.round(mouse_coords[0]/pixel_size*1);
				result.y = Math.round(mouse_coords[1]/pixel_size*1);
			} else {
				result.x = Math.floor(mouse_coords[0]/pixel_size*1);
				result.y = Math.floor(mouse_coords[1]/pixel_size*1);
			}
		} else if (Toolbox.selected.id === 'move_layer_tool') {
			result.x = Math.round(mouse_coords[0]/pixel_size*1);
			result.y = Math.round(mouse_coords[1]/pixel_size*1);
		} else {
			let offset = BarItems.slider_brush_size.get()%2 == 0 && Toolbox.selected.brush?.offset_even_radius ? 0.5 : 0;
			result.x = mouse_coords[0]/pixel_size*1 + offset;
			result.y = mouse_coords[1]/pixel_size*1 + offset;
			if (!Toolbox.selected.brush || Condition(Toolbox.selected.brush.floor_coordinates)) {
				result.x = Math.floor(result.x);
				result.y = Math.floor(result.y);
			}
		}
		if (tex) {
			if (tex.frameCount) result.y += (tex.height / tex.frameCount) * tex.currentFrame;
			if (!tex.frameCount && tex.ratio != tex.getUVWidth() / tex.getUVHeight() && UVEditor.vue.mode != 'paint') result.y /= tex.ratio;
			if (BarItems.image_tiled_view.value == true) {
				if (Painter.image_tiled_view_options.mirrored) {
					if (result.x < 0 || result.x >= tex.width) result.x = tex.width - result.x - 1;
					if (result.y < 0 || result.y >= tex.display_height) result.y = tex.display_height - result.y - 1;
				}
				result.x = (tex.width + result.x) % tex.width;
				result.y = (tex.display_height + result.y) % tex.display_height;
			}
		}
		// Snap line tool
		if (UVEditor.vue.mouse_coords.line_preview && event.ctrlOrCmd && UVEditor.vue.last_brush_position) {
			let original_pos = UVEditor.vue.last_brush_position.slice();
			let offset = [result.x - original_pos[0], result.y - original_pos[1]];
			let length = Math.sqrt(Math.pow(offset[0], 2) + Math.pow(offset[1], 2));
			let angle = Math.radToDeg(Math.atan2(offset[1], offset[0]));
			// Snapping
			let x_2 = Math.radToDeg(Math.atan(1/2));
			let x_3 = Math.radToDeg(Math.atan(1/3));
			let x_6 = Math.radToDeg(Math.atan(1/6));
			let snap_values = [0, 45];
			if (length > 16) {
				snap_values = [0, x_6, x_3, x_2, 33.75, 45, 90-33.75, 90-x_2, 90-x_3, 90 - x_6];
			} else if (length > 10) {
				snap_values = [0, x_3, x_2, , 45, 90-x_2, 90-x_3];
			} else if (length > 4) {
				snap_values = [0, x_2, 45, 90-x_2];
			}
			let osv = snap_values.slice();
			for (let i of [1, -1, -2]) {
				snap_values.push(...osv.map(v => v + i*90));
			}
			angle = Math.snapToValues(angle, snap_values, 90);
			angle = Math.degToRad(angle);
			result.x = original_pos[0] + Math.cos(angle) * length;
			result.y = original_pos[1] + Math.sin(angle) * length;
			// Round
			let px_offset = BarItems.slider_brush_size.get()%2 == 0 && Toolbox.selected.brush?.offset_even_radius ? 0.5 : 0;
			result.x = Math.round(result.x) + px_offset;
			result.y = Math.round(result.y) + px_offset;
			if (!Toolbox.selected.brush || Condition(Toolbox.selected.brush.floor_coordinates)) {
				result.x = Math.floor(result.x);
				result.y = Math.floor(result.y);
			}
		}
		return result;
	},
	startPaintTool(event) {
		delete Painter.current.face_matrices;
		delete Painter.current.element;

		var texture = this.getTexture()
		var coords = this.getBrushCoordinates(event, texture);
		
		let tool_result;
		if (Toolbox.selected.onTextureEditorClick) {
			tool_result = Toolbox.selected.onTextureEditorClick(texture, coords.x, coords.y, event);
		}
		if (tool_result !== false && texture) {
			if (event.target.id == 'uv_viewport') {
				// Discard scrollbar clicks
				if (event.offsetX >= event.target.clientWidth) return;
				if (event.offsetY >= event.target.clientHeight) return;
			}
			Painter.startPaintTool(texture, coords.x, coords.y, undefined, event);
			addEventListeners(UVEditor.vue.$refs.viewport, 'pointermove', UVEditor.movePaintTool, false );
			addEventListeners(document, 'pointerup', UVEditor.stopBrush, false );
		}
	},
	movePaintTool(event) {
		if (!PointerTarget.requestTarget(PointerTarget.types.paint)) return;
		if (event.pointerType === 'pen' && event.pressure === 0) {
			return;
		}
		var texture = UVEditor.getTexture()
		if (!texture) {
			Blockbench.showQuickMessage('message.untextured')
		} else if (event.which <= 1 || event.pointerType === 'pen' || Keybinds.extra.paint_secondary_color.keybind.isTriggered(event) || (event.touches && event.touches.length == 1)) {
			var new_face;
			var {x, y} = UVEditor.getBrushCoordinates(event, texture);
			if (texture.img.naturalWidth + texture.img.naturalHeight == 0) return;

			let interval = Toolbox.selected.brush?.interval || 1;
			let delta = [x - Painter.current.x, y - Painter.current.y];
			let distance = Math.sqrt(Math.pow(delta[0], 2) + Math.pow(delta[1], 2));
			if (distance < interval) {
				return;
			} else if (distance > interval && !(!Toolbox.selected.brush || Condition(Toolbox.selected.brush.floor_coordinates))) {
				let rounded_distance = Math.floor(distance/interval)*interval;
				x = Painter.current.x + (delta[0] / distance) * rounded_distance;
				y = Painter.current.y + (delta[1] / distance) * rounded_distance;
			}
			UVEditor.vue.mouse_coords.x = x;
			UVEditor.vue.mouse_coords.y = y;
			if (Painter.current.face !== UVEditor.getSelectedFaces(null)[0]) {
				Painter.current.x = x
				Painter.current.y = y
				Painter.current.face = UVEditor.getSelectedFaces(null)[0];
				new_face = true;
				if (texture !== Painter.current.texture && Undo.current_save) {
					Undo.current_save.addTextureOrLayer(texture)
				}
			}
			if (Toolbox.selected.id !== 'selection_tool') {
				Painter.movePaintTool(texture, x, y, event, new_face)
			}
		}
	},
	stopBrush(event) {
		removeEventListeners( UVEditor.vue.$refs.viewport, 'pointermove', UVEditor.movePaintTool, false );
		removeEventListeners( document, 'pointerup', UVEditor.stopBrush, false );
		if (Toolbox.selected.id !== 'selection_tool') {
			Painter.stopPaintTool()
		} else {
			UVEditor.stopSelection()
		}
	},

	selection_outline_lines: [],
	async updateSelectionOutline(recalculate_lines = true) {
		if (!Modes.paint) return;
		let {texture} = this.vue;
		if (!texture) {
			this.vue.selection_outline = '';
			return;
		}
		if (texture.selection.override == false) {
			this.vue.selection_outline = '';
			return;
		}
		let size = UVEditor.getTexturePixelSize();
		let width = this.vue.texture.width;
		let height = this.vue.texture.display_height;
		let full_height = this.vue.texture.height;

		if (texture.selection.override == true) {
			this.vue.selection_outline = `M1 1 L${width * size + 1} 1 L${width * size + 1} ${height * size + 1} L1 ${height * size + 1} L1 1`;
			return;
		}

		let anim_offset = UVEditor.vue.texture?.currentFrame ? (UVEditor.vue.texture?.currentFrame * UVEditor.vue.texture.display_height) : 0;
		let lines = UVEditor.selection_outline_lines;

		if (recalculate_lines) {
			lines.empty();
			let matrix = texture.selection;

			// Bounds
			let bounds = [Infinity, Infinity, 0, 0];
			for (let y = 0; y < full_height; y++) {
				for (let x = 0; x < width; x++) {
					let val = matrix.getDirect(x, y);
					if (val == 1) {
						bounds[0] = Math.min(bounds[0], x);
						bounds[1] = Math.min(bounds[1], y);
						bounds[2] = Math.max(bounds[2], x+1);
						bounds[3] = Math.max(bounds[3], y+1);
					}
				}
			}
			await new Promise(r => setTimeout(r, 0));
			// =
			for (let y = bounds[1]; y <= bounds[3]; y++) {
				let pre = null;
				for (let x = bounds[0]; x <= bounds[2]; x++) {
					let a = matrix.get(x, y-1);
					let b = matrix.get(x, y);
					let line = a != b;
					if (pre !== line) {
						if (pre !== null || line) {
							lines.push([!!line, x, y]);
						}
						pre = line;
					}
				}
			}
			await new Promise(r => setTimeout(r, 0));
			// ||
			for (let x = bounds[0]; x <= bounds[2]; x++) {
				let pre = null;
				for (let y = bounds[1]; y <= bounds[3]; y++) {
					let a = matrix.get(x-1, y);
					let b = matrix.get(x, y);
					let line = a != b;
					if (pre !== line) {
						if (pre !== null || line) {
							lines.push([!!line, x, y]);
						}
						pre = line;
					}
				}
			}
			await new Promise(r => setTimeout(r, 0));
		}
		size = UVEditor.getTexturePixelSize();
		let outline = '';
		for (let line of lines) {
			outline += `${outline ? '' : ' '}${line[0] ? 'M' : 'L'}${line[1] * size + 1} ${(line[2]-anim_offset) * size + 1}`;
		}
		this.vue.selection_outline = outline;
	},
	async focusOnSelection(zoom) {
		if (zoom instanceof Event) {
			zoom = BarItems.focus_on_selection.keybind.additionalModifierTriggered(zoom, 'zoom');
		}
		let [min_x, min_y, max_x, max_y] = this.vue.getSelectedUVBoundingBox(true);
		if (min_x == Infinity) return;
		if (zoom) {
			let width = (max_x-min_x) / UVEditor.getUVWidth();
			let height = (max_y-min_y) / UVEditor.getUVHeight();
			let target_zoom = 1/Math.max(width, height);
			if (UVEditor.isUVClamped()) {
				target_zoom = Math.clamp(UVEditor.zoom, target_zoom_factor * 0.618, Math.max(1, target_zoom_factor * 0.84));
			}
			UVEditor.setZoom(target_zoom);
			await new Promise(Vue.nextTick);
		}

		let pixel_size = UVEditor.inner_width / UVEditor.vue.uv_resolution[0];
		let focus = [min_x+max_x, min_y+max_y].map(v => v * 0.5 * pixel_size);
		let {viewport} = UVEditor.vue.$refs;
		let margin = UVEditor.vue.getFrameMargin();
		$(viewport).animate({
			scrollLeft: focus[0] + margin[0] - UVEditor.width / 2,
			scrollTop: focus[1] + margin[1] - UVEditor.height / 2,
		}, {
			duration: zoom ? 0 : 100,
			complete: () => {
				UVEditor.updateUVNavigator();
			}
		})
	},

	updateOverlayCanvas() {
		if (!UVEditor.texture) return;
		let canvas = UVEditor.overlay_canvas;
		let texture = UVEditor.texture;
		let ctx = canvas.getContext('2d');
		canvas.width = texture.width;

		if ((BarItems.image_tiled_view.value == true && Modes.paint) || (texture.wrap_mode == 'repeat' && Modes.edit)) {
			canvas.setAttribute('overlay_mode', 'tiled');
			canvas.width = texture.width * 3;
			canvas.height = texture.display_height * 3;
			if (Painter.image_tiled_view_options.mirrored) {
				// X
				ctx.scale(-1, 1);
				ctx.drawImage(texture.canvas, -1 * texture.width, 1 * texture.display_height);
				ctx.drawImage(texture.canvas, -3 * texture.width, 1 * texture.display_height);
				// Y
				ctx.scale(-1, -1);
				ctx.drawImage(texture.canvas, 1 * texture.width, -1 * texture.display_height);
				ctx.drawImage(texture.canvas, 1 * texture.width, -3 * texture.display_height);
				// XY
				ctx.scale(-1, 1);
				ctx.drawImage(texture.canvas, -1 * texture.width, -1 * texture.display_height);
				ctx.drawImage(texture.canvas, -1 * texture.width, -3 * texture.display_height);
				ctx.drawImage(texture.canvas, -3 * texture.width, -1 * texture.display_height);
				ctx.drawImage(texture.canvas, -3 * texture.width, -3 * texture.display_height);
				ctx.scale(-1, -1);
				
			} else {
				for (let x = 0; x < 3; x++) {
					for (let y = 0; y < 3; y++) {
						ctx.drawImage(texture.canvas, x * texture.width, y * texture.display_height);
					}
				}
			}
		} else if (BarItems.image_onion_skin_view.value == true && texture.frameCount > 2) {
			canvas.setAttribute('overlay_mode', 'onion_skin');
			let frames = [];
			switch (Painter.image_onion_skin_view_options.frame) {
				case 'last_viewed': frames = [UVEditor.previous_animation_frame]; break;
				case 'previous': frames = [texture.currentFrame-1]; break;
				case 'next': frames = [texture.currentFrame+1]; break;
				case 'both': frames = [texture.currentFrame-1, texture.currentFrame+1]; break;
			}
			frames = frames.map(f => (f+texture.frameCount) % texture.frameCount).filter(f => f != texture.currentFrame);

			if (Painter.image_onion_skin_view_options.display == 'transparent') {
				canvas.width = texture.width;
				canvas.height = texture.display_height;
				ctx.filter = `opacity(${45}%)`;
				for (let frame_offset of frames) {
					ctx.drawImage(texture.canvas, 0, frame_offset * -texture.display_height);
				}
			} else {
				canvas.width = texture.width * 4;
				canvas.height = texture.display_height * 4;
				ctx.filter = "";
				for (let frame_offset of frames) {
					let image_data = texture.canvas.getContext('2d').getImageData(0, frame_offset * texture.display_height, texture.width, texture.display_height);
					for (let i = 0; i < image_data.data.length; i += 4) {
						if (image_data.data[i+3] < 2) continue;
						ctx.fillStyle = `rgba(${image_data.data[i]}, ${image_data.data[i+1]}, ${image_data.data[i+2]}, ${image_data.data[i+3] / 460})`;
						let x = (i / 4) % texture.width;
						let y = Math.floor((i / 4) / texture.width);
						ctx.fillRect(x * 4 + 1, y * 4 + 1, 2, 2);
					}
				}
			}
		}
		let is_above = BarItems.image_onion_skin_view.value && Painter.image_onion_skin_view_options.above;
		canvas.classList.toggle('above', !!is_above);
	},
	//Get
	get width() {
		return this.vue.width;
	},
	get height() {
		return this.vue.height;
	},
	get zoom() {
		return this.vue.zoom;
	},
	get inner_width() {
		return this.vue.inner_width;
	},
	get inner_height() {
		return this.vue.inner_height;
	},
	get selected_faces() {
		return this.getSelectedFaces(this.getFirstMappableElement());
	},
	get texture() {
		return this.vue.texture;
	},
	isUVClamped(texture) {
		if (!texture) texture = UVEditor.vue.texture;
		if (texture) {
			return texture.wrap_mode == 'limited';
		} else {
			return Format.texture_wrap_default == 'limited';
		}
	},
	getUVWidth() {
		return this.texture ? this.texture.getUVWidth() : Project.texture_width;
	},
	getUVHeight() {
		return this.texture ? this.texture.getUVHeight() : Project.texture_height;
	},
	getPixelSize() {
		if (UVEditor.isBoxUV()) {
			return this.inner_width/UVEditor.getUVWidth()
		} else {
			return this.inner_width/ (
				(typeof this.texture === 'object' && this.texture.width)
					? this.texture.width
					: UVEditor.getUVWidth()
			);
		}
	},
	getUVPixelSize() {
		return this.inner_width/UVEditor.getUVWidth();
	},
	getTexturePixelSize() {
		return this.inner_width/ (
			(typeof this.texture === 'object' && this.texture.width)
				? this.texture.width
				: UVEditor.getUVWidth()
		);
	},
	getFaces(element, event, action) {
		let available = Object.keys(element.faces)
		if (event && (action ? action.keybind.additionalModifierTriggered(event, 'all_faces') : event.shiftKey)) {
			return available;
		} else {
			return UVEditor.getSelectedFaces(element).filter(key => available.includes(key));
		}
	},
	getReferenceFace() {
		let el = this.getFirstMappableElement();
		if (el) {
			let fkey = UVEditor.getSelectedFaces(el).find(fkey => el.faces[fkey]);
			return el.faces[fkey];
		}
	},
	getMappableElements() {
		return Outliner.selected.filter(el => typeof el.faces == 'object');
	},
	getFirstMappableElement() {
		return Outliner.selected.find(el => typeof el.faces == 'object');
	},
	getSelectedFaces(element, create) {
		if (!element) return [];
		if (element.getTypeBehavior('select_faces') == false) {
			return Object.keys(element.faces);
		}
		if (element.getSelectedFaces) {
			return element.getSelectedFaces(create);
		} else {
			if (!UVEditor.selected_element_faces[element.uuid]) {
				if (create) {
					let faces = UVEditor.selected_element_faces[element.uuid] = [];
					return faces;
				} else {
					return [];
				}
			} else {
				return UVEditor.selected_element_faces[element.uuid];
			}
		}
	},
	hasElements() {
		return Outliner.selected.findIndex(el => typeof el.faces == 'object') != -1;
	},
	getTexture() {
		if (Format.single_texture) return Texture.getDefault();
		return this.vue.texture;
	},
	isFaceUV() {
		let selected_cubes = Cube.selected;
		return !selected_cubes.length || !selected_cubes.find(cube => cube.box_uv);
	},
	isBoxUV() {
		let selected_cubes = Cube.selected;
		return selected_cubes.length ? !selected_cubes.find(cube => !cube.box_uv) : Project.box_uv;
	},
	isSelectedFaceMirrored(axis) {
		let reference_face = UVEditor.getReferenceFace();
		if (reference_face instanceof CubeFace) {
			reference_face.uv[axis+0] > reference_face.uv[axis+2]
		} else {
			let vertices = reference_face.getSortedVertices();
			if (vertices.length <= 2) return false;
			if (!Math.epsilon(reference_face.uv[vertices[0]][axis], reference_face.uv[vertices[1]][axis], 0.01)) {
				return reference_face.uv[vertices[0]][axis] > reference_face.uv[vertices[1]][axis];
			} else {
				return reference_face.uv[vertices[0]][axis] > reference_face.uv[vertices[2]][axis];
			}
		}
	},
	updateFaceSelection() {
		updateSelection();
	},
	//Set
	setZoom(zoom) {
		let min_size = UVEditor.isUVClamped() ? 64 : 20;
		let min_zoom = Math.clamp(min_size / UVEditor.height, 0.05, 0.4);
		let max_zoom = Math.round((this.vue.texture ? this.vue.texture.height : Project.texture_width) * 64 / UVEditor.width);
		zoom = Math.clamp(zoom, min_zoom, Math.clamp(max_zoom, 16, 128));
		this.vue.zoom = zoom;
		Project.uv_viewport.zoom = this.zoom;
		Vue.nextTick(() => {
			UVEditor.updateSelectionOutline(false);
		})
		return this;
	},
	setGrid(value) {
		if (value == 'auto') {
			this.auto_grid = true;
			this.vue.updateTexture()
		} else {
			value = parseInt(value);
			if (typeof value !== 'number') value = 1;
			this.grid = Math.clamp(value, 1, 1024);
			this.auto_grid = false;
		}
		this.updateSize();
		return this;
	},
	updateSize() {
		this.vue.updateSize();
	},
	//Selection
	reverseSelect(event, local_offset) {
		let scope = this;
		if (!this.vue.texture && !Format.single_texture) return this;
		if (!event.target.classList.contains('uv_size_handle') && !event.target.id === 'uv_frame') {
			return this;
		}
		let matches = [];
		let face_matches = [];
		let u = local_offset[0] / this.vue.inner_width * this.getResolution(0);
		let v = local_offset[1] / this.vue.inner_height * this.getResolution(1);
		Cube.all.forEach(cube => {
			if (cube.locked) return;
			for (let face in cube.faces) {
				let uv = cube.faces[face].uv
				if (uv && Math.isBetween(u, uv[0], uv[2]) && Math.isBetween(v, uv[1], uv[3]) && (cube.faces[face].getTexture() === scope.vue.texture || Format.single_texture)) {
					matches.safePush(cube);
					face_matches.push([cube, face]);
					break;
				}
			}
		})
		Mesh.all.forEach(mesh => {
			if (mesh.locked) return;
			for (var fkey in mesh.faces) {
				let face = mesh.faces[fkey];
				let rect = face.getBoundingRect();
				if (face.uv && Math.isBetween(u, rect.ax, rect.bx) && Math.isBetween(v, rect.ay, rect.by) && (face.getTexture() === scope.vue.texture || Format.single_texture)) {
					matches.safePush(mesh);
					face_matches.push([mesh, fkey]);
					break;
				}
			}
		})
		if (matches.length) {
			if (!event.shiftKey && !Pressing.overrides.shift && !event.ctrlOrCmd && !Pressing.overrides.ctrl) {
				for (let el of Project.selected_elements) {
					let selected = UVEditor.getSelectedFaces(el, true);
					if (selected.length) selected.empty();
				}
				Project.selected_elements.empty();
			}
			if (UVEditor.isFaceUV()) {
				for (let [el, fkey] of face_matches) {
					let selected = UVEditor.getSelectedFaces(el, true);
					selected.push(fkey);
				}
			}
			matches.forEach(s => {
				Project.selected_elements.safePush(s)
			});
			if (!event.shiftKey && Mesh.selected[0]) {
				UVEditor.selectMeshUVIsland(UVEditor.getSelectedFaces(Mesh.selected[0])[0]);
			}
			updateSelection();
		}
		return matches;
	},
	// Find which element face is at a given pixel coordinate in texture space
	findFaceAtUV(texture, x, y, uvFactorX, uvFactorY) {
		let animOffset = texture.display_height * texture.currentFrame;

		for (let cube of Cube.all.concat(Billboard.all)) {
			for (let faceKey in cube.faces) {
				let face = cube.faces[faceKey];
				let faceTexture = face.getTexture();
				if (!faceTexture || Painter.getTextureToEdit(faceTexture) !== texture) continue;

				let uv = face.uv;
				if (!uv) continue;

				let minX = Math.floor(Math.min(uv[0], uv[2]) * uvFactorX);
				let maxX = Math.ceil(Math.max(uv[0], uv[2]) * uvFactorX);
				let minY = Math.floor(Math.min(uv[1], uv[3]) * uvFactorY) + animOffset;
				let maxY = Math.ceil(Math.max(uv[1], uv[3]) * uvFactorY) + animOffset;

				if (x >= minX && x < maxX && y >= minY && y < maxY) {
					return { element: cube, faceKey, region: { minX, minY, maxX, maxY } };
				}
			}
		}

		for (let mesh of Mesh.all) {
			for (let faceKey in mesh.faces) {
				let face = mesh.faces[faceKey];
				let faceTexture = face.getTexture();
				if (!faceTexture || Painter.getTextureToEdit(faceTexture) !== texture) continue;
				if (face.vertices.length < 3) continue;

				let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
				for (let vkey in face.uv) {
					let uv = face.uv[vkey];
					minX = Math.min(minX, uv[0] * uvFactorX);
					maxX = Math.max(maxX, uv[0] * uvFactorX);
					minY = Math.min(minY, uv[1] * uvFactorY);
					maxY = Math.max(maxY, uv[1] * uvFactorY);
				}

				minX = Math.floor(minX);
				minY = Math.floor(minY) + animOffset;
				maxX = Math.ceil(maxX);
				maxY = Math.ceil(maxY) + animOffset;

				let polygon = face.getSortedVertices().map(vkey => face.uv[vkey]);
				if (pointInPolygon([x, y], polygon)) {
					return { element: mesh, faceKey, region: { minX, minY, maxX, maxY } };
				}
			}
		}

		return null;
	},
	forCubes(cb) {
		for (let element of Outliner.selected) {
			if (element.getTypeBehavior('cube_faces')) {
				cb(element);
			}
		}
	},
	forElements(cb) {
		this.getMappableElements().forEach(cb);
	},
	//Load
	loadData() {
		if (this.panel.folded) return this;
		this.vue.updateTexture();
		this.displayTools();
		//this.displayTools();
		this.vue.box_uv = UVEditor.isBoxUV();
		this.vue.uv_resolution.splice(0, 2,
			UVEditor.getUVWidth(),
			UVEditor.getUVHeight()
		);
		this.updateUVNavigator();
		this.vue.$forceUpdate();
		this.vue.updateElementOutlines();
		return this;
	},
	applyTexture(texture) {
		let elements = this.getMappableElements();

		if (Format.per_group_texture) {
			elements = [];
			let groups = Group.multi_selected;
			Outliner.selected.forEach(el => {
				if (el.faces && el.parent instanceof Group) groups.safePush(el.parent);
			});
			Undo.initEdit({groups});
			groups.forEach(group => {
				group.texture = texture.uuid;
				group.forEachChild(child => {
					if (child.faces) elements.safePush(child);
				})
			})
		} else {
			Undo.initEdit({elements, uv_only: true})
			elements.forEach(el => {
				let faces = (el.box_uv || Format.per_group_texture) ? UVEditor.cube_faces : UVEditor.getSelectedFaces(el);
				faces.forEach(face => {
					if (el.faces[face]) {
						el.faces[face].texture = texture.uuid;
					}
				})
			})
		}

		this.loadData()
		Canvas.updateView({elements, element_aspects: {faces: true, uv: true}})
		Undo.finishEdit('Apply texture')
	},
	displayTools() {
		for (let id in UVEditor.sliders) {
			let slider = UVEditor.sliders[id];
			slider.node.style.setProperty('display', Condition(slider.condition)?'block':'none');
			slider.update();
		}
		if (!this.hasElements()) return;
		let face = UVEditor.getReferenceFace();
		if (face instanceof CubeFace) {
			BarItems.uv_rotation.set((face && face.rotation)||0);
			if (Format.cullfaces) {
				BarItems.cullface.set(face.cullface||'off')
			}
			if (Format.java_face_properties) {
				BarItems.face_tint.setIcon(face.tint !== -1 ? 'check_box' : 'check_box_outline_blank')
				BarItems.slider_face_tint.update()
			}
		}
	},
	getFacePosition(axis) {
		let elements = UVEditor.getMappableElements();
		if (!elements[0]) return 0;

		if (UVEditor.isBoxUV() && elements[0].getTypeBehavior('cube_faces')) {
			return elements[0].uv_offset[axis];
		} else if (elements[0].getTypeBehavior('cube_faces')) {
			var face = UVEditor.getReferenceFace();
			if (face) {
				return face.uv[axis];
			}
		} else if (elements[0] instanceof Mesh) {
			let selected_vertices = elements[0].getSelectedVertices();

			if (selected_vertices.length) {
				let min = Infinity;
				UVEditor.getSelectedFaces(elements[0]).forEach(fkey => {
					let face = elements[0].faces[fkey];
					face.vertices.forEach(vkey => {
						if (selected_vertices.includes(vkey) && face.uv[vkey]) {
							min = Math.min(min, face.uv[vkey][axis]);
						}
					})
				})
				if (min == Infinity) min = 0;
				return min;

			} else {
				let face = UVEditor.getReferenceFace();
				if (!face) return 0;
				let min = Infinity;
				face.vertices.forEach(vkey => {
					if (face.uv[vkey]) {
						min = Math.min(min, face.uv[vkey][axis]);
					}
				})
				if (min == Infinity) min = 0;
				return min;
			}
		}
		return 0
	},
	getFaceSize(axis) {
		if (UVEditor.isFaceUV()) {
			let ref_face = UVEditor.getReferenceFace();
			if (ref_face instanceof CubeFace) {
				return ref_face.uv[axis+2] - ref_face.uv[axis];
			} else if (ref_face instanceof MeshFace) {
				let rect = ref_face.getBoundingRect();
				return axis ? rect.y : rect.x;
			}
		}
		return 0;
	},
	slidePos(modify, axis) {
		let min = 0;
		let max = this.getResolution(axis);
		let clamped = UVEditor.isUVClamped();

		Outliner.selected.forEach(function(obj) {
			if (!obj.getTypeBehavior('cube_faces')) return;
			if (obj.box_uv === true) {
				if (axis === 0) {
					var size = (obj.size(0) + (obj.size(1) ? obj.size(2) : 0))*2
					if (obj.size(1) == 0) min = -obj.size(2);
				} else {
					var size = obj.size(2) + obj.size(1)
					if (obj.size(0) == 0) min = -obj.size(2);
				}
				var value = modify(obj.uv_offset[axis])

				if (clamped) {
					value = limitNumber(value, min, max);
					value = limitNumber(value + size, min, max) - size;
				}
				obj.uv_offset[axis] = Math.round(value);
			} else {
				UVEditor.getSelectedFaces(obj).forEach(fkey => {
					if (!obj.faces[fkey]) return;
					let uvTag = obj.faces[fkey].uv;
					var size = uvTag[axis + 2] - uvTag[axis]
	
					var value = modify(uvTag[axis])
	
					if (clamped) {
						value = limitNumber(value, 0, max);
						value = limitNumber(value + size, 0, max) - size;
					}
					uvTag[axis] = value
					uvTag[axis+2] = value + size
				})
			}
			obj.preview_controller.updateUV(obj);
		})
		Mesh.selected.forEach(mesh => {
			let selected_vertices = mesh.getSelectedVertices();
			
			if (selected_vertices.length) {
				UVEditor.getSelectedFaces(mesh).forEach(fkey => {
					if (!mesh.faces[fkey]) return
					selected_vertices.forEach(vkey => {
						if (!mesh.faces[fkey].vertices.includes(vkey)) return;
						mesh.faces[fkey].uv[vkey][axis] = modify(mesh.faces[fkey].uv[vkey][axis]);
					})
				})
			} else {
				UVEditor.getSelectedFaces(mesh).forEach(fkey => {
					if (!mesh.faces[fkey]) return
					let face = mesh.faces[fkey];
					let face_rect = face.getBoundingRect();
					let face_start = [face_rect.ax, face_rect.ay];
					let offset = modify(face_start[axis]) - face_start[axis];
					face.vertices.forEach(vkey => {
						face.uv[vkey][axis] += offset;
					})
				})
			}
			mesh.preview_controller.updateUV(mesh);
		})
		this.displayTools()
		this.vue.$forceUpdate()
		this.vue.updateElementOutlines();
	},
	slideSize(modify, axis) {
		let limit = this.getResolution(axis);

		Outliner.selected.forEach(function(obj) {
			if (!obj.getTypeBehavior('cube_faces')) return;
			if (obj.box_uv !== true) {
				UVEditor.getSelectedFaces(obj).forEach(fkey => {
					var uvTag = obj.faces[fkey].uv;
					var difference = modify(uvTag[axis+2]-uvTag[axis]) + uvTag[axis];
					uvTag[axis+2] = limitNumber(difference, 0, limit);
					obj.preview_controller.updateUV(obj);
				})
			}
		})
		Mesh.selected.forEach(mesh => {
			for (let fkey of mesh.getSelectedFaces()) {
				let face = mesh.faces[fkey];
				let rect = face.getBoundingRect();
				let start = (axis ? rect.ay : rect.ax);
				let size = (axis ? rect.y : rect.x);
				let multiplier = modify(size) / size;
				face.vertices.forEach(vkey => {
					if (!face.uv[vkey]) return;
					face.uv[vkey][axis] = (face.uv[vkey][axis] - start) * multiplier + start;
					if (isNaN(face.uv[vkey][axis])) face.uv[vkey][axis] = start;
				})
			}
			Mesh.preview_controller.updateUV(mesh);
		})
		this.displayTools()
		this.disableAutoUV()
		this.vue.$forceUpdate()
		this.vue.updateElementOutlines();
	},
	getResolution(axis, texture) {
		return axis ? UVEditor.getUVHeight() : UVEditor.getUVWidth();
	},
	saveViewportOffset() {
		let uv_viewport = this.vue.$refs.viewport;
		if (!uv_viewport || !Project || Blockbench.hasFlag('switching_project') || !uv_viewport.clientWidth || !uv_viewport.scrollLeft) return;
		Project.uv_viewport.offset[0] = (uv_viewport.scrollLeft - this.width/2) / this.vue.inner_width;
		Project.uv_viewport.offset[1] = (uv_viewport.scrollTop - this.height/2) / this.vue.inner_height;
	},
	loadViewportOffset() {
		let uv_viewport = this.vue.$refs.viewport;
		if (!uv_viewport || !Project) return;
		UVEditor.setZoom(Project.uv_viewport.zoom);
		let project = Project;
		Vue.nextTick(() => {
			if (!Project || project != Project) return;
			uv_viewport.scrollLeft = Project.uv_viewport.offset[0] * this.vue.inner_width + this.width/2;
			uv_viewport.scrollTop = Project.uv_viewport.offset[1] * this.vue.inner_height + this.height/2;
		})
	},
	beforeMoving() {
		UVEditor.saveViewportOffset();
		setTimeout(() => {
			UVEditor.loadViewportOffset();
		}, 0);
	},
	// TODO: Turn into onMove event hook
	updateUVNavigator() {
		if (Format.image_editor) {
			ReferenceImage.active.forEach(ref => {
				if (ref.is_blueprint) ref.updateTransform();
			})
		}
		if (UVEditor.vue.mode != 'uv') return;
		let style = UVEditor.getUVNavigatorStyle();
		let element = UVEditor.vue.$el.querySelector('.uv_navigator');
		if (!element) return;
		if (style) {
			for (let key in style) {
				element.style.setProperty(key, style[key]);
			}
			element.style.display = 'block';
		} else {
			element.style.display = 'none';
		}
	},
	getUVNavigatorStyle() {
		let vue = UVEditor.vue;
		if (UVEditor.zoom < 1.3) return;
		let mappable_element = vue.mappable_elements.find(el => (el.box_uv || (UVEditor.getSelectedFaces(el)?.length)));
		if (!mappable_element) return;
		let box = vue.getSelectedUVBoundingBox();
		if (!box) return;

		let uv_viewport = vue.$refs.viewport;
		if (!uv_viewport || !Project || Blockbench.hasFlag('switching_project') || !uv_viewport.clientWidth) return;
		let offset = [
			(uv_viewport.scrollLeft - vue.width/2) / vue.inner_width,
			(uv_viewport.scrollTop - vue.height/2) / vue.inner_height
		];
		let {zoom, uv_resolution} = vue;
		let view_box = [
			offset[0] * uv_resolution[0],
			offset[1] * uv_resolution[1],
			(offset[0] + vue.width/vue.inner_width) * uv_resolution[0],
			(offset[1] + vue.width/vue.inner_width) * uv_resolution[1],
		];

		let [x1_1, y1_1, x2_1, y2_1] = box;
		let [x1_2, y1_2, x2_2, y2_2] = view_box;
		let out_of_view = (x2_1 < x1_2 || x1_1 > x2_2 || y2_1 < y1_2 || y1_1 > y2_2);
		if (!out_of_view) return;

		let direction = Math.atan2(
			Math.lerp(y1_2, y2_2, 0.5) - Math.lerp(y1_1, y2_1, 0.5),
			Math.lerp(x1_2, x2_2, 0.5) - Math.lerp(x1_1, x2_1, 0.5),
		);
		let direction_degrees = Math.radToDeg(direction);
		let screen_offset = uv_viewport.getBoundingClientRect();
		let style = {
			'--rotation': (direction_degrees-90) + 'deg',
			left: (screen_offset.x) + 'px',
			top: (screen_offset.y) + 'px',
		};
		let rotation_range = Math.round(2 * direction / Math.PI);
		let rotation_modulo = ((direction_degrees + 540 + 45) % 90) / 90;
		rotation_modulo = Math.hermiteBlend(rotation_modulo);
		switch (rotation_range) {
			case 2: case -2: {
				style.left = (screen_offset.x + vue.width - 25) + 'px';
				style.top = (screen_offset.y + rotation_modulo*(vue.height - 25)) + 'px';
				break;
			}
			case -1: {
				style.left = (screen_offset.x + (1-rotation_modulo)*(vue.width - 25)) + 'px';
				style.top = (screen_offset.y + vue.height - 25) + 'px';
				break;
			}
			case 0: {
				style.left = (screen_offset.x) + 'px';
				style.top = (screen_offset.y + (1-rotation_modulo)*(vue.height - 25)) + 'px';
				break;
			}
			case 1: {
				style.left = (screen_offset.x + rotation_modulo*(vue.width - 25)) + 'px';
				style.top = (screen_offset.y) + 'px';
				break;
			}
		}
		return style;
	},

	//Events
	selectAll() {
		let selected_before = 0;
		let total_selectable = 0;
		this.vue.mappable_elements.forEach(element => {
			let selected_faces = UVEditor.getSelectedFaces(element, true);
			selected_before += selected_faces.length;
			for (let key in element.faces) {
				selected_faces.safePush(key);
				total_selectable++;
			}
		})
		if (selected_before == total_selectable) {
			this.vue.mappable_elements.forEach(element => {
				let selected_faces = UVEditor.getSelectedFaces(element, true);
				selected_faces.empty();
			})
		}
		UVEditor.displayTools();
	},
	selectMeshUVIsland(face_key) {
		let mesh = Mesh.selected[0];
		let selected_faces = mesh.getSelectedFaces(true);
		if (face_key && mesh && mesh.faces[face_key]) {
			if (selected_faces.length == 1) {
				let vkey_fkey_map = {};
				let faces = mesh.faces;
				for (let fkey in faces) {
					let face = faces[fkey];
					for (let vkey of face.vertices) {
						vkey_fkey_map[vkey] ??= [];
						vkey_fkey_map[vkey].push(fkey);
					}
				}
				function crawl(face) {
					for (let i = 0; i < face.vertices.length; i++) {
						let adjacent = face.getAdjacentFace(i, vkey_fkey_map);
						if (!adjacent) continue;
						if (selected_faces.includes(adjacent.key)) continue;
						let epsilon = 0.2;
						let uv_a1 = adjacent.face.uv[adjacent.edge[0]];
						let uv_a2 = face.uv[adjacent.edge[0]];
						if (!Math.epsilon(uv_a1[0], uv_a2[0], epsilon) || !Math.epsilon(uv_a1[1], uv_a2[1], epsilon)) continue;
						let uv_b1 = adjacent.face.uv[adjacent.edge[1]];
						let uv_b2 = face.uv[adjacent.edge[1]];
						if (!Math.epsilon(uv_b1[0], uv_b2[0], epsilon) || !Math.epsilon(uv_b1[1], uv_b2[1], epsilon)) continue;
						selected_faces.push(adjacent.key);
						if (BarItems.selection_mode.value == 'face') {
							let selected_faces = mesh.getSelectedFaces(true);
							selected_faces.safePush(adjacent.key);
						}
						crawl(adjacent.face);
					}
				}
				crawl(mesh.faces[face_key]);
			} else {
				selected_faces.replace([face_key]);
			}
			UVEditor.vue.$forceUpdate();
			UVEditor.vue.updateElementOutlines();
			updateSelection();
		}
	},
	moveSelection(offset, event) {
		Undo.initEdit({elements: UVEditor.getMappableElements()})
		let step = canvasGridSize(event.shiftKey || Pressing.overrides.shift, event.ctrlOrCmd || Pressing.overrides.ctrl) / UVEditor.grid;
		if (UVEditor.isBoxUV()) step = 1;
		UVEditor.slidePos((old_val) => {
			let sign = offset[offset[0] ? 0 : 1];
			return old_val + step * sign;
		}, offset[0] ? 0 : 1);
		Undo.finishEdit('Move UV')
	},
	disableAutoUV() {
		this.forCubes(obj => {
			obj.autouv = 0
		})
	},
	toggleUV() {
		let face = UVEditor.getReferenceFace();
		let state = face.enabled === false;
		this.forCubes(cube => {
			UVEditor.getSelectedFaces(cube).forEach(face => {
				cube.faces[face].enabled = state;
			})
		})
	},
	maximize(event) {
		var scope = this;
		this.forCubes(obj => {
			scope.getFaces(obj, event, BarItems.uv_maximize).forEach(function(side) {
				obj.faces[side].uv = [0, 0, scope.getResolution(0, obj.faces[side]), scope.getResolution(1, obj.faces[side])]
			})
			obj.autouv = 0;
			obj.preview_controller.updateUV(obj);
		})
		this.message('uv_editor.maximized')
		this.loadData()
	},
	turnMapping(event) {
		var scope = this;
		this.forCubes(obj => {
			scope.getFaces(obj, event, BarItems.uv_turn_mapping).forEach(function(side) {
				var uv = obj.faces[side].uv_size;
				obj.faces[side].uv_size = [uv[1], uv[0]];
				if (uv[0] < 0) {
					obj.faces[side].uv[0] += uv[0];
					obj.faces[side].uv[2] += uv[0];
					obj.faces[side].uv[1] -= uv[0];
					obj.faces[side].uv[3] -= uv[0];
				}
				if (uv[1] < 0) {
					obj.faces[side].uv[1] += uv[1];
					obj.faces[side].uv[3] += uv[1];
					obj.faces[side].uv[0] -= uv[1];
					obj.faces[side].uv[2] -= uv[1];
				}
				if (UVEditor.isUVClamped()) {
					let overlap_px = Math.clamp(Math.max(obj.faces[side].uv[0], obj.faces[side].uv[2]) - UVEditor.getUVWidth(), 0, Infinity);
					obj.faces[side].uv[0] -= overlap_px;
					obj.faces[side].uv[2] -= overlap_px;
					let overlap_py = Math.clamp(Math.max(obj.faces[side].uv[1], obj.faces[side].uv[3]) - UVEditor.getUVHeight(), 0, Infinity);
					obj.faces[side].uv[1] -= overlap_py;
					obj.faces[side].uv[3] -= overlap_py;
				}
			})
			obj.autouv = 0;
			obj.preview_controller.updateUV(obj);
		})
		this.message('uv_editor.turned');
		this.loadData();
	},
	setAutoSize(event, silent, face_keys) {		
		let vec1 = new THREE.Vector3(),
			vec2 = new THREE.Vector3(),
			vec3 = new THREE.Vector3(),
			vec4 = new THREE.Vector3(),
			plane = new THREE.Plane();

		this.getMappableElements().forEach(obj => {
			let height, width;
			let faces = face_keys || this.getFaces(obj, event, BarItems.uv_auto);
			if (obj.getTypeBehavior('cube_faces')) {
				faces.forEach(function(side) {
					let face = obj.faces[side];
					let mirror_x = face.uv[0] > face.uv[2];
					let mirror_y = face.uv[1] > face.uv[3];
					face.uv[0] = Math.min(face.uv[0], face.uv[2]);
					face.uv[1] = Math.min(face.uv[1], face.uv[3]);
					if (side == 'north' || side == 'south') {
						width = Math.abs(obj.size(0));
						height = Math.abs(obj.size(1));
					} else if (side == 'east' || side == 'west') {
						width = Math.abs(obj.size(2));
						height = Math.abs(obj.size(1));
					} else if (side == 'up' || side == 'down') {
						width = Math.abs(obj.size(0));
						height = Math.abs(obj.size(2));
					} else {
						width = Math.abs(obj.size(0));
						height = Math.abs(obj.size(1));
					}
					if (face.rotation % 180) {
						[width, height] = [height, width];
					}
					const uv_width = UVEditor.getUVWidth();
                    const uv_height = UVEditor.getUVHeight();
					width *= UVEditor.getResolution(0, face) / uv_width;
					height *= UVEditor.getResolution(1, face) / uv_height;
					if (UVEditor.isUVClamped())
					{
						width = Math.clamp(width, 0, uv_width);
						height = Math.clamp(height, 0, uv_height);
						face.uv[0] = Math.min(face.uv[0], uv_width - width);
						face.uv[1] = Math.min(face.uv[1], uv_height - height);
					}
					face.uv_size = [width, height];
					// left2 *= UVEditor.getResolution(0, face) / UVEditor.getUVWidth();
					// top2 *= UVEditor.getResolution(1, face) / UVEditor.getUVHeight();
					// face.uv_size = [left2, top2];
					if (mirror_x) [face.uv[0], face.uv[2]] = [face.uv[2], face.uv[0]];
					if (mirror_y) [face.uv[1], face.uv[3]] = [face.uv[3], face.uv[1]];
				})
				obj.autouv = 0

			} else if (obj instanceof Mesh) {
				faces.forEach(fkey => {
					let face = obj.faces[fkey];
					let vertex_uvs = {};
					let uv_center = [0, 0];
					let new_uv_center = [0, 0];
					let normal_vec = vec1.fromArray(face.getNormal(true));
					plane.setFromNormalAndCoplanarPoint(
						normal_vec,
						vec2.fromArray(obj.vertices[face.vertices[0]])
					)
					let rot = cameraTargetToRotation([0, 0, 0], normal_vec.toArray());
					let e = new THREE.Euler(Math.degToRad(rot[1] - 90), Math.degToRad(rot[0] + 180), 0);
					face.vertices.forEach(vkey => {
						let coplanar_pos = plane.projectPoint(vec3.fromArray(obj.vertices[vkey]), vec4.set(0, 0, 0));
						coplanar_pos.applyEuler(e);
						vertex_uvs[vkey] = [
							Math.roundTo(coplanar_pos.x, 4),
							Math.roundTo(coplanar_pos.z, 4),
						]
					})
					// Rotate UV to match corners
					let rotation_angles = {};
					let precise_rotation_angle = {};
					let vertices = face.getSortedVertices();
					vertices.forEach((vkey, i) => {
						let vkey2 = vertices[i+1] || vertices[0];
						let rot = Math.atan2(
							vertex_uvs[vkey2][0] - vertex_uvs[vkey][0],
							vertex_uvs[vkey2][1] - vertex_uvs[vkey][1],
						)
						let snap = 2;
						rot = (Math.radToDeg(rot) + 360) % 90;
						let rounded = Math.round(rot / snap) * snap;
						if (rotation_angles[rounded]) {
							rotation_angles[rounded]++;
						} else {
							rotation_angles[rounded] = 1;
							precise_rotation_angle[rounded] = rot;
						}
					})
					let angles = Object.keys(rotation_angles).map(k => parseInt(k));
					angles.sort((a, b) => {
						let diff = rotation_angles[b] - rotation_angles[a];
						if (diff) {
							return diff;
						} else {
							return a < b ? -1 : 1;
						}
					})
					let angle = Math.degToRad(precise_rotation_angle[angles[0]]);
					let s = Math.sin(angle);
					let c = Math.cos(angle);
					for (let vkey in vertex_uvs) {
						let point = vertex_uvs[vkey].slice();
						vertex_uvs[vkey][0] = point[0] * c - point[1] * s;
						vertex_uvs[vkey][1] = point[0] * s + point[1] * c;
					}

					// Find position on UV map
					let pmin_x = Infinity, pmin_y = Infinity;
					face.vertices.forEach(vkey => {
						pmin_x = Math.min(pmin_x, vertex_uvs[vkey][0]);
						pmin_y = Math.min(pmin_y, vertex_uvs[vkey][1]);
					})
					face.vertices.forEach(vkey => {
						uv_center[0] += face.uv[vkey] ? face.uv[vkey][0] : 0;
						uv_center[1] += face.uv[vkey] ? face.uv[vkey][1] : 0;
						new_uv_center[0] += vertex_uvs[vkey][0];
						new_uv_center[1] += vertex_uvs[vkey][1];
					})
					uv_center[0] = Math.round((uv_center[0] - new_uv_center[0]) / face.vertices.length);
					uv_center[1] = Math.round((uv_center[1] - new_uv_center[1]) / face.vertices.length);

					let min_x = Infinity, min_y = Infinity, max_x = 0, max_y = 0;
					for (let vkey in vertex_uvs) {
						vertex_uvs[vkey][0] = vertex_uvs[vkey][0] - ((pmin_x+1000.5) % 1 - 0.5) + uv_center[0],
						vertex_uvs[vkey][1] = vertex_uvs[vkey][1] - ((pmin_y+1000.5) % 1 - 0.5) + uv_center[1],
						min_x = Math.min(min_x, vertex_uvs[vkey][0]);
						min_y = Math.min(min_y, vertex_uvs[vkey][1]);
						max_x = Math.max(max_x, vertex_uvs[vkey][0]);
						max_y = Math.max(max_y, vertex_uvs[vkey][1]);
					}
					// Prevent overflow
					let offset = [
						min_x < 0 ? -min_x : (max_x > UVEditor.getUVWidth() ? Math.round(UVEditor.getUVWidth() - max_x) : 0),
						min_y < 0 ? -min_y : (max_y > UVEditor.getUVHeight() ? Math.round(UVEditor.getUVHeight() - max_y) : 0),
					];
					face.vertices.forEach(vkey => {
						face.uv[vkey] = [
							vertex_uvs[vkey][0] + offset[0],
							vertex_uvs[vkey][1] + offset[1],
						]
					})
				})
			}
			obj.preview_controller.updateUV(obj);
		})
		if (!silent) this.message('uv_editor.autouv');
		this.loadData();
	},
	setRelativeAutoSize(event) {
		var scope = this;
		this.forCubes(obj => {
			scope.getFaces(obj, event, BarItems.uv_rel_auto).forEach(function(side) {
				var uv = obj.faces[side].uv,
					ru = scope.getResolution(0, obj.faces[side]),
					rv = scope.getResolution(1, obj.faces[side]);
				switch (side) {
					case 'north':
					uv = [
						ru - obj.to[0],
						rv - obj.to[1],
						ru - obj.from[0],
						rv - obj.from[1],
					];
					break;
					case 'south':
					uv = [
						obj.from[0],
						rv - obj.to[1],
						obj.to[0],
						rv - obj.from[1],
					];
					break;
					case 'west':
					uv = [
						obj.from[2],
						rv - obj.to[1],
						obj.to[2],
						rv - obj.from[1],
					];
					break;
					case 'east':
					uv = [
						ru - obj.to[2],
						rv - obj.to[1],
						ru - obj.from[2],
						rv - obj.from[1],
					];
					break;
					case 'up':
					uv = [
						obj.from[0],
						obj.from[2],
						obj.to[0],
						obj.to[2],
					];
					break;
					case 'down':
					uv = [
						obj.from[0],
						rv - obj.to[2],
						obj.to[0],
						rv - obj.from[2],
					];
					break;
				}
				uv.forEach(function(s, uvi) {
					uv[uvi] = limitNumber(s, 0, uvi%2 ? rv : ru);
				})
				obj.faces[side].uv = uv
			})
			obj.autouv = 0
			obj.preview_controller.updateUV(obj);
		})
		this.message('uv_editor.autouv')
		this.loadData()
	},
	mirrorX(event) {
		var scope = this;
		let do_move_texture = !!(BarItems.move_texture_with_uv.value && this.texture);
		let texturesModified = new Set();

		this.forElements(obj => {
			if (obj.getTypeBehavior('cube_faces')) {
				scope.getFaces(obj, event, BarItems.uv_mirror_x).forEach((side) => {
					let face = obj.faces[side];

					if (do_move_texture && face.texture !== null) {
						let texture = face.getTexture();
						if (texture && texture.ctx) {
							let factor_x = texture.width / UVEditor.getUVWidth();
							let factor_y = texture.height / UVEditor.getUVHeight();
							let uv = face.uv;
							let x = Math.floor(Math.min(uv[0], uv[2]) * factor_x);
							let y = Math.floor(Math.min(uv[1], uv[3]) * factor_y);
							let w = Math.ceil(Math.abs(uv[2] - uv[0]) * factor_x) || 1;
							let h = Math.ceil(Math.abs(uv[3] - uv[1]) * factor_y) || 1;

							let pixels = texture.ctx.getImageData(x, y, w, h);
							let flipped = flipImageDataH(pixels);
							texture.ctx.putImageData(flipped, x, y);
							texturesModified.add(texture);
						}
					}

					var proxy = face.uv[0]
					face.uv[0] = face.uv[2]
					face.uv[2] = proxy
				})
			} else if (obj instanceof Mesh) {
				let min = Infinity;
				let max = -Infinity;
				scope.getFaces(obj, event, BarItems.uv_mirror_x).forEach((side) => {
					obj.faces[side].vertices.forEach(vkey => {
						min = Math.min(min, obj.faces[side].uv[vkey][0]);
						max = Math.max(max, obj.faces[side].uv[vkey][0]);
					})
				})
				let center = Math.lerp(min, max, 0.5);

				scope.getFaces(obj, event, BarItems.uv_mirror_x).forEach((side) => {
					obj.faces[side].vertices.forEach(vkey => {
						obj.faces[side].uv[vkey][0] = center*2 - obj.faces[side].uv[vkey][0];
					})
				})
			}
			if (obj.autouv) obj.autouv = 0
			obj.preview_controller.updateUV(obj);
		})

		for (let texture of texturesModified) {
			texture.updateChangesAfterEdit();
		}

		this.message('uv_editor.mirrored')
		this.loadData()
	},
	mirrorY(event) {
		var scope = this;
		let do_move_texture = !!(BarItems.move_texture_with_uv.value && this.texture);
		let texturesModified = new Set();

		this.forElements(obj => {
			if (obj.getTypeBehavior('cube_faces')) {
				scope.getFaces(obj, event, BarItems.uv_mirror_y).forEach((side) => {
					let face = obj.faces[side];

					if (do_move_texture && face.texture !== null) {
						let texture = face.getTexture();
						if (texture && texture.ctx) {
							let factor_x = texture.width / UVEditor.getUVWidth();
							let factor_y = texture.height / UVEditor.getUVHeight();
							let uv = face.uv;
							let x = Math.floor(Math.min(uv[0], uv[2]) * factor_x);
							let y = Math.floor(Math.min(uv[1], uv[3]) * factor_y);
							let w = Math.ceil(Math.abs(uv[2] - uv[0]) * factor_x) || 1;
							let h = Math.ceil(Math.abs(uv[3] - uv[1]) * factor_y) || 1;

							let pixels = texture.ctx.getImageData(x, y, w, h);
							let flipped = flipImageDataV(pixels);
							texture.ctx.putImageData(flipped, x, y);
							texturesModified.add(texture);
						}
					}

					var proxy = face.uv[1]
					face.uv[1] = face.uv[3]
					face.uv[3] = proxy
				})
			} else if (obj instanceof Mesh) {
				let min = Infinity;
				let max = -Infinity;
				scope.getFaces(obj, event, BarItems.uv_mirror_y).forEach((side) => {
					obj.faces[side].vertices.forEach(vkey => {
						min = Math.min(min, obj.faces[side].uv[vkey][1]);
						max = Math.max(max, obj.faces[side].uv[vkey][1]);
					})
				})
				let center = Math.lerp(min, max, 0.5);

				scope.getFaces(obj, event, BarItems.uv_mirror_y).forEach((side) => {
					obj.faces[side].vertices.forEach(vkey => {
						obj.faces[side].uv[vkey][1] = center*2 - obj.faces[side].uv[vkey][1];
					})
				})
			}
			if (obj.autouv) obj.autouv = 0;
			obj.preview_controller.updateUV(obj);
		})

		for (let texture of texturesModified) {
			texture.updateChangesAfterEdit();
		}

		this.message('uv_editor.mirrored')
		this.loadData()
	},
	applyAll() {
		let ref_face = this.getReferenceFace();
		this.forCubes(cube => {
			UVEditor.cube_faces.forEach(side => {
				cube.faces[side].extend(ref_face);
			})
			cube.autouv = 0
		})
		Canvas.updateSelectedFaces()
		this.message('uv_editor.to_all')
		this.loadData()
	},
	clear(event) {
		var scope = this;
		Undo.initEdit({elements: Cube.selected, uv_only: true})
		this.forCubes(obj => {
			scope.getFaces(obj, event, BarItems.uv_transparent).forEach(function(side) {
				obj.faces[side].uv = [0, 0, 0, 0]
				obj.faces[side].texture = null;
			})
			obj.preview_controller.updateFaces(obj);
		})
		this.loadData()
		this.message('uv_editor.transparent')
		Undo.finishEdit('Remove face')
		Canvas.updateSelectedFaces()
	},
	switchCullface(event) {
		Undo.initEdit({elements: Cube.selected, uv_only: true})
		var val = BarItems.cullface.get()
		if (val === 'off') val = false
		this.forCubes(obj => {
			UVEditor.getSelectedFaces(obj).forEach(fkey => {
				obj.faces[fkey].cullface = val || '';
			})
		})
		if (val) {
			this.message('uv_editor.cullface_on')
		} else {
			this.message('uv_editor.cullface_off')
		}
		Undo.finishEdit('Toggle cullface')
	},
	switchTint(event) {
		var val = UVEditor.getReferenceFace().tint === -1 ? 0 : -1;

		if (event === 0 || event === false) val = event
		this.forCubes(obj => {
			UVEditor.getSelectedFaces(obj).forEach(fkey => {
				obj.faces[fkey].tint = val;
			})
		})
		if (val !== -1) {
			this.message('uv_editor.tint_on')
		} else {
			this.message('uv_editor.tint_off')
		}
		this.displayTools()
	},
	setTint(event, val) {
		this.forCubes(obj => {
			UVEditor.getSelectedFaces(obj).forEach(fkey => {
				obj.faces[fkey].tint = val;
			})
		})
		this.displayTools()
	},
	rotate(mesh_angle) {
		var value = parseInt(BarItems.uv_rotation.get());
		let ref_face = this.getReferenceFace();
		let do_move_texture = !!(BarItems.move_texture_with_uv.value && this.texture && this._originalRotations && this._originalPixels);
		let texturesModified = new Set();

		if (do_move_texture && Format.uv_rotation) {
			this.forCubes(obj => {
				this.getSelectedFaces(obj).forEach(fkey => {
					let face = obj.faces[fkey];
					if (face.texture === null) return;

					let key = obj.uuid + ':' + fkey;
					let oldRot = this._originalRotations[key] || 0;
					let delta = (value - oldRot + 360) % 360;

					let data = this._originalPixels[key];
					if (!data || !data.pixels) return;

					let rotated = rotateImageDataByDegrees(data.pixels, delta);

					let clearSize = Math.max(data.w, data.h);
					data.texture.ctx.clearRect(data.x, data.y, clearSize, clearSize);
					data.texture.ctx.putImageData(rotated, data.x, data.y);
					texturesModified.add(data.texture);
				})
			})
			// Update texture display
			for (let texture of texturesModified) {
				texture.updateSource(texture.canvas.toDataURL());
			}
		}

		if (Cube.selected[0] && ref_face instanceof CubeFace && Math.abs(ref_face.rotation - value) % 180 == 90) {
			UVEditor.turnMapping();
		}
		if (Format.uv_rotation) {
			this.forCubes(obj => {
				this.getSelectedFaces(obj).forEach(face => {
					obj.faces[face].rotation = value;
				})
				obj.preview_controller.updateUV(obj);
			})
		}
		let rect = this.vue.getSelectedUVBoundingBox();
		let center = [(rect[0] + rect[2]) / 2, (rect[1] + rect[3]) / 2];
		Mesh.selected.forEach(mesh => {
			mesh.getSelectedFaces().forEach((fkey) => {
				let face = mesh.faces[fkey];
				if (face.vertices.length < 3) return;

				face.vertices.forEach(vkey => {
					if (!face.uv[vkey]) return;
					let sin = Math.sin(Math.degToRad(mesh_angle));
					let cos = Math.cos(Math.degToRad(mesh_angle));
					face.uv[vkey][0] -= center[0];
					face.uv[vkey][1] -= center[1];
					let a = (face.uv[vkey][0] * cos - face.uv[vkey][1] * sin);
					let b = (face.uv[vkey][0] * sin + face.uv[vkey][1] * cos);
					face.uv[vkey][0] = a + center[0];
					face.uv[vkey][1] = b + center[1];
					if (UVEditor.isUVClamped()) {
						face.uv[vkey][0] = Math.clamp(face.uv[vkey][0], 0, UVEditor.getUVWidth());
						face.uv[vkey][1] = Math.clamp(face.uv[vkey][1], 0, UVEditor.getUVHeight());
					}
				})
			})
			Mesh.preview_controller.updateUV(mesh);
		})
		this.loadData();
		this.message('uv_editor.rotated')
	},
	setRotation(value) {
		value = parseInt(value)
		this.forCubes(obj => {
			this.getSelectedFaces(obj).forEach(face => {
				obj.faces[face].rotation = value;
			})
			obj.preview_controller.updateUV(obj);
		})
		this.loadData()
		this.message('uv_editor.rotated')
	},
	selectGridSize(event) {
	},
	autoCullface(event) {
		this.forCubes(obj => {
			UVEditor.getFaces(obj, event, BarItems.auto_cullface).forEach(function(side) {
				obj.faces[side].cullface = side
			})
		})
		this.loadData()
		this.message('uv_editor.auto_cull')
	},
	copy(event) {
		let elements = this.getMappableElements();
		if (!elements.length) return;
		let multiple = BarItems.copy.keybind.additionalModifierTriggered(event) == 'multiple';

		UVEditor.clipboard = []

		if (UVEditor.isBoxUV() && Cube.selected[0]) {
			var new_tag = {
				uv: Cube.selected[0].uv_offset
			}
			UVEditor.clipboard.push(new_tag)
			this.message('uv_editor.copied')
			return;
		}

		function addToClipboard(key) {
			let element = elements[0];
			if (!element) return;
			var tag = element.faces[key];
			var new_face;
			if (element instanceof Mesh) {
				new_face = new MeshFace(null, tag);
				Property.resetUniqueValues(MeshFace, new_face);
				new_face.vertices = tag.getSortedVertices();
				new_face.direction = key;
			} else if (element instanceof Billboard) {
				new_face = new BillboardFace(key, tag);
				Property.resetUniqueValues(BillboardFace, new_face);
			} else {
				new_face = new CubeFace(key, tag);
				Property.resetUniqueValues(CubeFace, new_face);
			}
			UVEditor.clipboard.push(new_face);
		}
		if (multiple) {
			for (let key in elements[0].faces) {
				addToClipboard(key)
			}
		} else {
			UVEditor.getSelectedFaces(elements[0]).forEach(key => {
				addToClipboard(key);
			})
		}
		this.message('uv_editor.copied_x', [UVEditor.clipboard.length])
	},
	paste(event) {
		let elements = UVEditor.getMappableElements();
		if (UVEditor.clipboard === null || elements.length === 0) return;

		let multiple = BarItems.paste.keybind.additionalModifierTriggered(event) == 'multiple';


		Undo.initEdit({elements, uv_only: true})
		if (UVEditor.isBoxUV() && UVEditor.clipboard[0].uv instanceof Array) {
			Cube.selected.forEach(function(el) {
				el.uv_offset = UVEditor.clipboard[0].uv.slice()
				el.preview_controller.updateUV(el);
			})
		}

		function mergeFace(element, key, tag) {
			if (!element.faces[key]) return;
			let face = element.faces[key];
			if (element instanceof Mesh) {

				let uv_points = [];
				tag.vertices.forEach(vkey => {
					uv_points.push(tag.uv[vkey]);
				})
				face.getSortedVertices().forEach((vkey, i) => {
					if (uv_points[i]) face.uv[vkey].replace(uv_points[i]);
				})
				face.texture = tag.texture;
			} else {
				face.extend(tag);
			}
		}

		if (multiple || UVEditor.clipboard.length === 1) {
			let tag = UVEditor.clipboard[0];
			elements.forEach(el => {
				if (el.getTypeBehavior('cube_faces') && el.box_uv) return;
				if ((el.getTypeBehavior('cube_faces') && tag instanceof CubeFace) || (el instanceof Mesh && tag instanceof MeshFace)) {
					let selected_faces = UVEditor.getSelectedFaces(el);
					for (let key in el.faces) {
						if (multiple || selected_faces.includes(key)) {
							mergeFace(el, key, tag);
						}
					}
					el.preview_controller.updateUV(el);
					el.preview_controller.updateFaces(el);
				}
			})
		} else {
			UVEditor.clipboard.forEach(tag => {
				elements.forEach(el => {
					if (el.getTypeBehavior('cube_faces') && el.box_uv) return;
					if ((el.getTypeBehavior('cube_faces') && tag instanceof CubeFace) || (el instanceof Mesh && tag instanceof MeshFace)) {
						let key = tag.direction;
						if (el.faces[key]) {
							mergeFace(el, key, tag);
						}
					}
				})
			})
			elements.forEach(el => {
				el.preview_controller.updateUV(el);
				el.preview_controller.updateFaces(el);
			})
		}
		this.loadData()
		Canvas.updateSelectedFaces()
		this.message('uv_editor.pasted')
		Undo.finishEdit('Paste UV')
	},
	reset(event) {
		var scope = this;
		this.forCubes(obj => {
			scope.getFaces(obj, event, BarItems.uv_reset).forEach(function(side) {
				obj.faces[side].reset()
			})
			obj.preview_controller.updateFaces(obj);
			obj.preview_controller.updateUV(obj);
		})
		this.loadData()
		this.message('uv_editor.reset')
	},

	// Dialog
	clipboard: null,
	cube_faces: ['north', 'south', 'west', 'east', 'up', 'down'],
	forSelection(cb, event, ...args) {
		UVEditor[cb](event, ...args);
	},


	menu: new Menu([
		new MenuSeparator('interface'),
		{name: 'menu.view.zoom', id: 'zoom', icon: 'search', children: [
			'zoom_in',
			'zoom_out',
			'zoom_reset'
		]},
		{name: 'settings.display_uv', id: 'display_uv', icon: 'visibility', condition: () => (Modes.edit && !Format.image_editor), children: () => {
			let options = ['selected_faces', 'selected_elements', 'all_elements'];
			return options.map(option => {return {
				id: option,
				name: `settings.display_uv.${option}`,
				icon: UVEditor.vue.display_uv == option ? 'far.fa-dot-circle' : 'far.fa-circle',
				condition: !(option == 'selected_faces' && UVEditor.isBoxUV() && !Mesh.selected.length),
				click() {
					UVEditor.vue.display_uv = option;
					settings.display_uv.set(option);
				}
			}})
		}},
		'focus_on_selection',
		'painting_grid',
		'uv_checkerboard',
		'paint_mode_uv_overlay',
		new MenuSeparator('copypaste'),
		'copy',
		'paste',
		'cube_uv_mode',
		new MenuSeparator('uv'),
		{
			name: 'menu.uv.export',
			icon: () => UVEditor.getReferenceFace()?.enabled !== false ? 'check_box' : 'check_box_outline_blank',
			condition: () => (!UVEditor.isBoxUV() && UVEditor.getReferenceFace() && Format.java_face_properties),
			click(event) {
				Undo.initEdit({elements: Cube.selected, uv_only: true});
				UVEditor.toggleUV(event);
				Undo.finishEdit('Toggle UV export');
			}
		},
		'uv_maximize',
		'uv_auto',
		'uv_rel_auto',
		'uv_project_from_view',
		'move_uv_to_cursor',
		'connect_uv_faces',
		'merge_uv_vertices',
		'snap_uv_to_pixels',
		'uv_rotate_left',
		'uv_rotate_right',
		{icon: 'rotate_90_degrees_ccw', condition: () => UVEditor.getReferenceFace() instanceof CubeFace && Format.uv_rotation, name: 'menu.uv.mapping.rotation', children() {
			let reference_face = UVEditor.getReferenceFace();
			let off = 'far.fa-circle';
			let on = 'far.fa-dot-circle';
			return [
				{icon: (!reference_face.rotation ? on : off), name: '0°', click() {
					Undo.initEdit({elements: Outliner.selected.filter(el => el.getTypeBehavior('cube_faces')), uv_only: true})
					UVEditor.setRotation(0)
					Undo.finishEdit('Rotate UV')
				}},
				{icon: (reference_face.rotation === 90 ? on : off), name: '90°', click() {
					Undo.initEdit({elements: Outliner.selected.filter(el => el.getTypeBehavior('cube_faces')), uv_only: true})
					UVEditor.setRotation(90)
					Undo.finishEdit('Rotate UV')
				}},
				{icon: (reference_face.rotation === 180 ? on : off), name: '180°', click() {
					Undo.initEdit({elements: Outliner.selected.filter(el => el.getTypeBehavior('cube_faces')), uv_only: true})
					UVEditor.setRotation(180)
					Undo.finishEdit('Rotate UV')
				}},
				{icon: (reference_face.rotation === 270 ? on : off), name: '270°', click() {
					Undo.initEdit({elements: Outliner.selected.filter(el => el.getTypeBehavior('cube_faces')), uv_only: true})
					UVEditor.setRotation(270)
					Undo.finishEdit('Rotate UV')
				}}
			]
		}},
		'uv_cycle',
		'uv_cycle_invert',
		'uv_turn_mapping',
		{
			name: 'menu.uv.flip_x',
			icon: () => (UVEditor.isSelectedFaceMirrored(0) ? 'check_box' : 'check_box_outline_blank'),
			condition: () => Modes.edit && !UVEditor.isBoxUV() && UVEditor.getReferenceFace(),
			click(event) {
				Undo.initEdit({elements: UVEditor.getMappableElements(), uv_only: true});
				UVEditor.mirrorX(event);
				Undo.finishEdit('Flip UV');
			}
		},
		{
			name: 'menu.uv.flip_y',
			icon: () => (UVEditor.isSelectedFaceMirrored(1) ? 'check_box' : 'check_box_outline_blank'),
			condition: () => Modes.edit && !UVEditor.isBoxUV() && UVEditor.getReferenceFace(),
			click(event) {
				Undo.initEdit({elements: UVEditor.getMappableElements(), uv_only: true});
				UVEditor.mirrorY(event);
				Undo.finishEdit('Flip UV');
			}
		},
		new MenuSeparator('face_options'),
		'face_tint',
		{icon: 'flip_to_back', condition: () => (Format.cullfaces && Cube.selected.length && UVEditor.getReferenceFace()), name: 'action.cullface' , children: function() {
			let off = 'far.fa-circle';
			let on = 'far.fa-dot-circle';
			function setCullface(cullface) {
				Undo.initEdit({elements: Cube.selected, uv_only: true})
				UVEditor.forCubes(obj => {
					UVEditor.getSelectedFaces(obj).forEach(face => {
						obj.faces[face].cullface = cullface;
					})
				})
				Undo.finishEdit(cullface ? `Set cullface to ${cullface}` : 'Disable cullface');
			}
			return [
				{icon: (!UVEditor.getReferenceFace().cullface ? on : off), name: 'uv_editor.no_faces', click: () => setCullface('')},
				{icon: (UVEditor.getReferenceFace().cullface == 'north' ? on : off), name: 'face.north', click: () => setCullface('north')},
				{icon: (UVEditor.getReferenceFace().cullface == 'south' ? on : off), name: 'face.south', click: () => setCullface('south')},
				{icon: (UVEditor.getReferenceFace().cullface == 'west' ? on : off), name: 'face.west', click: () => setCullface('west')},
				{icon: (UVEditor.getReferenceFace().cullface == 'east' ? on : off), name: 'face.east', click: () => setCullface('east')},
				{icon: (UVEditor.getReferenceFace().cullface == 'up' ? on : off), name: 'face.up', click: () => setCullface('up')},
				{icon: (UVEditor.getReferenceFace().cullface == 'down' ? on : off), name: 'face.down', click: () => setCullface('down')},
				'auto_cullface'
			]
		}},
		{icon: 'collections', name: 'menu.uv.texture', condition: () => UVEditor.getReferenceFace() && !Format.single_texture, children: function() {
			let arr = [
				{icon: 'crop_square', name: Format.single_texture_default ? 'menu.cube.texture.default' : 'menu.cube.texture.blank', click: function(context, event) {
					let elements = UVEditor.vue.mappable_elements.slice();

					if (Format.per_group_texture) {
						elements = [];
						let groups = Group.multi_selected;
						Outliner.selected.forEach(el => {
							if (el.faces && el.parent instanceof Group) groups.safePush(el.parent);
						});
						Undo.initEdit({groups});
						groups.forEach(group => {
							group.texture = '';
							group.forEachChild(child => {
								if (child.faces) elements.safePush(child);
							})
						})
					} else {
						Undo.initEdit({elements, uv_only: true})
						elements.forEach((obj) => {
							UVEditor.getFaces(obj, event).forEach(fkey => {
								obj.faces[fkey].texture = false;
							})
						})
					}
					UVEditor.loadData()
					Canvas.updateView({elements, element_aspects: {faces: true, uv: true}})
					UVEditor.message('uv_editor.reset')
					Undo.finishEdit('Apply blank texture')
				}},
				{icon: 'clear', name: 'menu.cube.texture.transparent', condition: () => UVEditor.getReferenceFace() instanceof CubeFace, click: function(event) {UVEditor.clear(event)}},
			]
			Texture.all.forEach(function(t) {
				arr.push({
					name: t.name,
					icon: (t.mode === 'link' ? t.img : t.source),
					marked: t == UVEditor.texture,
					click() {
						UVEditor.applyTexture(t);
					}
				})
			})
			return arr;
		}}
	]),
	menu_image_editor: new Menu([
		'screenshot_model',
		new MenuSeparator('references'),
		'add_reference_image',
		'reference_image_from_clipboard',
		'toggle_all_reference_images',
		'edit_reference_images',
		new MenuSeparator('interface'),
		{name: 'menu.view.zoom', id: 'zoom', icon: 'search', children: [
			'zoom_in',
			'zoom_out',
			'zoom_reset'
		]},
		'painting_grid',
		'image_editor_checkerboard',
		new MenuSeparator('copypaste'),
		'copy',
		'paste',
	])
}

SharedActions.add('select_all', {
	condition: () => Prop.active_panel == 'uv' && Modes.edit,
	run() {
		Undo.initSelection();
		UVEditor.selectAll()
		UVEditor.vue.$forceUpdate();
		Undo.finishSelection('Select all UV');
	}
})
SharedActions.add('select_all', {
	condition: () => Prop.active_panel == 'uv' && Modes.paint && UVEditor.texture,
	run() {
		Undo.initSelection({texture_selection: true});
		UVEditor.texture.selection.setOverride(UVEditor.texture.selection.override == true ? false : true);
		UVEditor.updateSelectionOutline();
		Undo.finishSelection('Select all');
		Interface.removeSuggestedModifierKey('alt', 'modifier_actions.drag_to_duplicate');
	}
})
SharedActions.add('unselect_all', {
	condition: () => Prop.active_panel == 'uv' && Modes.edit,
	run() {
		Undo.initSelection();
		UVEditor.getMappableElements().forEach(element => {
			UVEditor.getSelectedFaces(element, true).empty();
		})
		UVEditor.displayTools();
		UVEditor.vue.$forceUpdate();
		Undo.finishSelection('Unselect all UV');
	}
})
SharedActions.add('unselect_all', {
	condition: () => Prop.active_panel == 'uv' && Modes.paint && UVEditor.texture,
	run() {
		Undo.initSelection({texture_selection: true});
		UVEditor.texture.selection.setOverride(false);
		Undo.finishSelection('Unselect all');
		UVEditor.updateSelectionOutline();
		Interface.removeSuggestedModifierKey('alt', 'modifier_actions.drag_to_duplicate');
	}
})
SharedActions.add('invert_selection', {
	condition: () => Prop.active_panel == 'uv' && Modes.paint && UVEditor.texture,
	run() {
		Undo.initSelection({texture_selection: true});
		let texture = UVEditor.texture;
		if (texture.selection.is_custom) {
			texture.selection.forEachPixel((x, y, val, index) => {
				texture.selection.array[index] = val ? 0 : 1;
			})
		} else {
			texture.selection.setOverride(!texture.selection.override);
		}
		UVEditor.updateSelectionOutline();
		Undo.finishSelection('Invert selection');
	}
})

BARS.defineActions(function() {

	new BarSlider('uv_rotation', {
		category: 'uv',
		condition: () => Modes.edit && UVEditor.isFaceUV() && Format.uv_rotation && Cube.selected.length,
		min: 0, max: 270, step: 90, width: 80, circular: true,
		onBefore: () => {
			let do_move_texture = !!(BarItems.move_texture_with_uv.value && UVEditor.texture);
			Undo.initEdit({
				elements: Cube.selected,
				uv_only: true,
				bitmap: do_move_texture,
				textures: do_move_texture ? [UVEditor.texture] : undefined
			})
			if (do_move_texture) {
				UVEditor._originalRotations = {};
				UVEditor._originalPixels = {};
				Cube.selected.forEach(cube => {
					UVEditor.getSelectedFaces(cube).forEach(fkey => {
						let face = cube.faces[fkey];
						let key = cube.uuid + ':' + fkey;
						UVEditor._originalRotations[key] = face.rotation || 0;

						if (face.texture !== null) {
							let texture = face.getTexture();
							if (texture && texture.ctx) {
								let factor_x = texture.width / UVEditor.getUVWidth();
								let factor_y = texture.height / UVEditor.getUVHeight();
								let uv = face.uv;
								let x = Math.floor(Math.min(uv[0], uv[2]) * factor_x);
								let y = Math.floor(Math.min(uv[1], uv[3]) * factor_y);
								let w = Math.ceil(Math.abs(uv[2] - uv[0]) * factor_x) || 1;
								let h = Math.ceil(Math.abs(uv[3] - uv[1]) * factor_y) || 1;
								UVEditor._originalPixels[key] = {
									texture,
									x, y, w, h,
									pixels: texture.ctx.getImageData(x, y, w, h)
								};
							}
						}
					});
				});
			}
		},
		onChange: function() {
			UVEditor.rotate();
		},
		onAfter: () => {
			if (UVEditor._originalPixels) {
				let texturesModified = new Set();
				for (let key in UVEditor._originalPixels) {
					texturesModified.add(UVEditor._originalPixels[key].texture);
				}
				for (let texture of texturesModified) {
					texture.updateChangesAfterEdit();
				}
			}
			delete UVEditor._originalRotations;
			delete UVEditor._originalPixels;
			Undo.finishEdit('Rotate UV')
		}
	})
	new BarSelect('uv_grid', { 
		category: 'uv',
		condition: () => Modes.edit && UVEditor.isFaceUV() && Cube.selected.length,
		min_width: 68,
		value: 'auto',
		options: {
			'auto': 'Pixel',
			'1x': '1x',
			'2x': '2x',
			'3x': '3x',
			'4x': '4x',
			'6x': '6x',
			'8x': '8x',
		},
		onChange: function(slider) {
			var value = slider.get().replace(/x/, '');
			UVEditor.setGrid(value);
		}
	})
	new Action('uv_maximize', {
		icon: 'zoom_out_map',
		category: 'uv',
		condition: () => Modes.edit && UVEditor.isFaceUV() && Cube.selected.length,
		keybind: new Keybind({}, {
			all_faces: 'shift'
		}),
		variations: {
			all_faces: {name: 'action.uv_maximize.all_faces'}
		},
		click: function (event) { 
			Undo.initEdit({elements: Cube.selected, uv_only: true})
			UVEditor.forSelection('maximize', event)
			Undo.finishEdit('Maximize UV')
		}
	})
	new Action('uv_turn_mapping', {
		icon: 'screen_rotation',
		category: 'uv',
		condition: () => Modes.edit && UVEditor.isFaceUV() && Cube.selected.length,
		keybind: new Keybind({}, {
			all_faces: 'shift'
		}),
		variations: {
			all_faces: {name: 'action.uv_maximize.all_faces'}
		},
		click: function (event) { 
			Undo.initEdit({elements: Cube.selected, uv_only: true})
			UVEditor.forSelection('turnMapping', event)
			Undo.finishEdit('Turn UV mapping')
		}
	})
	new Action('uv_auto', {
		icon: 'brightness_auto',
		category: 'uv',
		condition: () => Modes.edit && ((UVEditor.isFaceUV() && Cube.selected.length) || Mesh.selected.length),
		keybind: new Keybind({}, {
			all_faces: 'shift'
		}),
		variations: {
			all_faces: {name: 'action.uv_maximize.all_faces'}
		},
		click: function (event) {
			Undo.initEdit({elements: UVEditor.getMappableElements(), uv_only: true})
			UVEditor.forSelection('setAutoSize', event)
			Undo.finishEdit('Auto UV')
		}
	})
	new Action('uv_project_from_view', {
		icon: 'view_in_ar',
		category: 'uv',
		condition: () => Modes.edit && UVEditor.isFaceUV() && Mesh.selected.length,
		click(event) {
			Undo.initEdit({elements: Mesh.selected, uv_only: true})

			let preview = Preview.selected;
			let vector = new THREE.Vector3();

			function projectPoint(vector) {
				let widthHalf = 0.5 * preview.canvas.width / window.devicePixelRatio;
				let heightHalf = 0.5 * preview.canvas.height / window.devicePixelRatio;
				vector.project(preview.camera);
				return [
					 ( vector.x * widthHalf ) + widthHalf,
					-( vector.y * heightHalf ) + heightHalf
				]
			}
			Mesh.selected.forEach(mesh => {
				let scale = preview.calculateControlScale(mesh.getWorldCenter()) / 14;
				let selected_faces = UVEditor.getSelectedFaces(mesh);
				let vertices = {};
				let min = [Infinity, Infinity];
				let max = [-Infinity, -Infinity];
				let previous_origin = [0, 0];
				let face_count = 0;
				
				for (let fkey in mesh.faces) {
					if (!selected_faces.includes(fkey)) continue;
					mesh.faces[fkey].vertices.forEach(vkey => {
						if (vertices[vkey]) return;

						vertices[vkey] = projectPoint( mesh.mesh.localToWorld(vector.fromArray(mesh.vertices[vkey])) );
						for (let i of [0, 1]) {
							vertices[vkey][i] *= scale;
							min[i] = Math.min(min[i], vertices[vkey][i]);
							max[i] = Math.max(max[i], vertices[vkey][i]);
							previous_origin[i] += mesh.faces[fkey].uv[vkey][i];
						}
						face_count++;
					})
				}

				previous_origin.V2_divide(face_count);
				let offset = previous_origin.map((previous, i) => {
					let difference = previous - Math.lerp(min[i], max[i], 0.5);
					return Math.clamp(difference, -min[1], max[1]);
				})

				for (let fkey in mesh.faces) {
					if (!selected_faces.includes(fkey)) continue;
					mesh.faces[fkey].vertices.forEach(vkey => {
						mesh.faces[fkey].uv[vkey][0] = vertices[vkey][0] + offset[0];
						mesh.faces[fkey].uv[vkey][1] = vertices[vkey][1] + offset[1];
					})
				}
				mesh.preview_controller.updateUV(mesh);
			})

			UVEditor.loadData();
			Undo.finishEdit('Auto UV')
		}
	})
	new Action('uv_rel_auto', {
		icon: 'brightness_auto',
		category: 'uv',
		condition: () => Modes.edit && UVEditor.isFaceUV() && Cube.selected.length,
		keybind: new Keybind({}, {
			all_faces: 'shift'
		}),
		variations: {
			all_faces: {name: 'action.uv_maximize.all_faces'}
		},
		click: function (event) {
			Undo.initEdit({elements: Cube.selected, uv_only: true})
			UVEditor.forSelection('setRelativeAutoSize', event)
			Undo.finishEdit('Auto UV')
		}
	})
	new Action('uv_mirror_x', {
		icon: 'icon-mirror_x',
		category: 'uv',
		condition: () => Modes.edit && UVEditor.isFaceUV() && UVEditor.hasElements(),
		keybind: new Keybind({}, {
			all_faces: 'shift'
		}),
		variations: {
			all_faces: {name: 'action.uv_maximize.all_faces'}
		},
		click: function (event) {
			let do_move_texture = !!(BarItems.move_texture_with_uv.value && UVEditor.texture);
			Undo.initEdit({
				elements: UVEditor.getMappableElements(),
				uv_only: true,
				bitmap: do_move_texture,
				textures: do_move_texture ? [UVEditor.texture] : undefined
			})
			UVEditor.forSelection('mirrorX', event)
			Undo.finishEdit('Mirror UV')
		}
	})
	new Action('uv_mirror_y', {
		icon: 'icon-mirror_y',
		category: 'uv',
		condition: () => Modes.edit && UVEditor.isFaceUV() && UVEditor.hasElements(),
		keybind: new Keybind({}, {
			all_faces: 'shift'
		}),
		variations: {
			all_faces: {name: 'action.uv_maximize.all_faces'}
		},
		click: function (event) {
			let do_move_texture = !!(BarItems.move_texture_with_uv.value && UVEditor.texture);
			Undo.initEdit({
				elements: UVEditor.getMappableElements(),
				uv_only: true,
				bitmap: do_move_texture,
				textures: do_move_texture ? [UVEditor.texture] : undefined
			})
			UVEditor.forSelection('mirrorY', event)
			Undo.finishEdit('Mirror UV')
		}
	})
	new Action('uv_rotate_left', {
		icon: 'rotate_left',
		category: 'uv',
		condition: () => Modes.edit && Mesh.selected.length,
		keybind: new Keybind({}, {
			all_faces: 'shift'
		}),
		variations: {
			all_faces: {name: 'action.uv_maximize.all_faces'}
		},
		click: function (event) {
			Undo.initEdit({elements: Mesh.selected, uv_only: true})
			UVEditor.rotate(-90);
			Undo.finishEdit('Rotate UV left');
		}
	})
	new Action('uv_rotate_right', {
		icon: 'rotate_right',
		category: 'uv',
		condition: () => Modes.edit && Mesh.selected.length,
		keybind: new Keybind({}, {
			all_faces: 'shift'
		}),
		variations: {
			all_faces: {name: 'action.uv_maximize.all_faces'}
		},
		click: function (event) {
			Undo.initEdit({elements: Mesh.selected, uv_only: true})
			UVEditor.rotate(90);
			Undo.finishEdit('Rotate UV right');
		}
	})
	new Action('uv_transparent', {
		icon: 'clear',
		category: 'uv',
		condition: () => Modes.edit && UVEditor.isFaceUV() && Cube.selected.length,
		keybind: new Keybind({}, {
			all_faces: 'shift'
		}),
		variations: {
			all_faces: {name: 'action.uv_maximize.all_faces'}
		},
		click: function (event) {
			UVEditor.forSelection('clear', event)
		}
	})
	new Action('uv_reset', {
		icon: 'replay',
		category: 'uv',
		condition: () => Modes.edit && UVEditor.isFaceUV() && Cube.selected.length,
		keybind: new Keybind({}, {
			all_faces: 'shift'
		}),
		variations: {
			all_faces: {name: 'action.uv_maximize.all_faces'}
		},
		click: function (event) {
			Undo.initEdit({elements: Cube.selected, uv_only: true})
			UVEditor.forSelection('reset', event)
			Undo.finishEdit('Reset UV')
		}
	})
	new Action('uv_apply_all', {
		icon: 'format_color_fill',
		category: 'uv',
		condition: () => Modes.edit && UVEditor.isFaceUV() && Cube.selected.length,
		click: function (e) {
			Undo.initEdit({elements: Cube.selected, uv_only: true})
			UVEditor.applyAll(e)
			Undo.finishEdit('Apply UV to all faces')
		}
	})
	new BarSelect('cullface', { 
		category: 'uv',
		condition: () => Modes.edit && UVEditor.isFaceUV() && Format.cullfaces && Cube.selected.length && UVEditor.getReferenceFace(),
		label: true,
		options: {
			off: tl('uv_editor.no_faces'),
			north: tl('face.north'),
			south: tl('face.south'),
			west: tl('face.west'),
			east: tl('face.east'),
			up: tl('face.up'),
			down: tl('face.down'),
		},
		onChange: function(sel, event) {
			Undo.initEdit({elements: Cube.selected, uv_only: true});
			UVEditor.forSelection('switchCullface');
			Undo.finishEdit('Set cullface');
		}
	})
	new Action('auto_cullface', {
		icon: 'block',
		category: 'uv',
		condition: () => Modes.edit && UVEditor.isFaceUV() && Format.cullfaces && Cube.selected.length && UVEditor.getReferenceFace(),
		keybind: new Keybind({}, {
			all_faces: 'shift'
		}),
		variations: {
			all_faces: {name: 'action.uv_maximize.all_faces'}
		},
		click: function (event) {
			Undo.initEdit({elements: Cube.selected, uv_only: true})
			UVEditor.forSelection('autoCullface', event)
			Undo.finishEdit('Set automatic cullface')
		}
	})
	new Action('face_tint', {
		category: 'uv',
		condition: () => Modes.edit && UVEditor.isFaceUV() && Format.java_face_properties && Cube.selected.length && UVEditor.getReferenceFace(),
		click: function (event) {
			Undo.initEdit({elements: Cube.selected, uv_only: true})
			UVEditor.forSelection('switchTint', event)
			Undo.finishEdit('Toggle face tint')
		}
	})
	new NumSlider('slider_face_tint', {
		category: 'uv',
		condition: () => Modes.edit && UVEditor.isFaceUV() && Format.java_face_properties && Cube.selected.length && UVEditor.getReferenceFace(),
		getInterval(event) {
			return 1;
		},
		get: function() {
			return Cube.selected[0] && Cube.selected[0].faces[UVEditor.getSelectedFaces(Cube.selected[0], false)[0]].tint
		},
		change: function(modify) {
			let number = Math.clamp(Math.round(modify(this.get())), -1)
			UVEditor.setTint(null, number);
		},
		onBefore: function() {
			Undo.initEdit({elements: Cube.selected, uv_only: true})
		},
		onAfter: function() {
			Undo.finishEdit('Set face tint')
		}
	})
	new Action('move_uv_to_cursor', {
		icon: 'fas.fa-magnet',
		category: 'uv',
		keybind: new Keybind({alt: true, key: 'u'}),
		condition: {modes: ['edit'], method: () => UVEditor.hasElements()},
		click(event) {
			Undo.initEdit({elements: UVEditor.getMappableElements(), uv_only: true})
			let center = [
				UVEditor.getFacePosition(0) + Math.round(UVEditor.getFaceSize(0)/2),
				UVEditor.getFacePosition(1) + Math.round(UVEditor.getFaceSize(1)/2),
			];
			let cursor_pos = [
				// Previous mouse coords, convert from pixel space to UV space
				UVEditor.vue.mouse_coords.x * (UVEditor.getUVWidth() / UVEditor.texture.width),
				UVEditor.vue.mouse_coords.y * (UVEditor.getUVHeight() / UVEditor.texture.height),
			];
			UVEditor.slidePos((val) => val + cursor_pos[0] - center[0], 0);
			UVEditor.slidePos((val) => val + cursor_pos[1] - center[1], 1);
			Undo.finishEdit('Move UV to cursor');
		}
	})
	new Action('merge_uv_vertices', {
		icon: 'close_fullscreen',
		category: 'uv',
		condition: () => Modes.edit && UVEditor.isFaceUV() && Mesh.selected[0] && UVEditor.getSelectedFaces(Mesh.selected[0]).length >= 2,
		click: function (event) {
			Undo.initEdit({elements: Mesh.selected, uv_only: true})
			Mesh.selected.forEach(mesh => {
				let selected_vertices = mesh.getSelectedVertices();
				let selected_faces = mesh.getSelectedFaces();
				let face1 = mesh.faces[selected_faces.last()];
				let target_coords = {};
				let main_target_coord;
				face1.vertices.forEach(vkey => {
					if (!selected_vertices.includes(vkey)) return;
					target_coords[vkey] = face1.uv[vkey];
					main_target_coord = face1.uv[vkey];
				});
				selected_faces.forEach(fkey => {
					let face = mesh.faces[fkey];
					if (!face || face == face1) return;
					let i = 0;
					face.vertices.forEach(vkey => {
						if (selected_vertices.includes(vkey) && face.uv[vkey]) {
							face.uv[vkey][0] = (target_coords[vkey] || main_target_coord)[0];
							face.uv[vkey][1] = (target_coords[vkey] || main_target_coord)[1];
							i++;
						}
					})
				})
				mesh.preview_controller.updateUV(mesh);
			})
			UVEditor.loadData();
			Undo.finishEdit('Merge UV vertices');
		}
	})
	new Action('connect_uv_faces', {
		icon: 'move_up',
		category: 'uv',
		condition: () => Modes.edit && UVEditor.isFaceUV() && Mesh.selected[0] && UVEditor.getSelectedFaces(Mesh.selected[0]).length >= 2,
		click: function (event) {
			Undo.initEdit({elements: Mesh.selected, uv_only: true})
			Mesh.selected.forEach(mesh => {
				let selected_faces = mesh.getSelectedFaces();
				let face1 = mesh.faces[selected_faces.last()];
				let face2 = mesh.faces[selected_faces[0]];

				// Get edge to connect
				let connection_edge_1 = face1.vertices.filter(vkey => face2.vertices.includes(vkey));
				let connection_edge_2;
				if (connection_edge_1.length == 2) {
					connection_edge_2 = connection_edge_1;
				} else {
					// array to make sure we don't end up with 2x the same vkey on face 2
					let face2_used_vkeys = [];
					let vertex_distances = face1.vertices.map(vkey => {
						let uv_1 = face1.uv[vkey];
						let distance_b = Infinity;
						let closest_from_face_2;
						face2.vertices.forEach(vkey2 => {
							if (face2_used_vkeys.includes(vkey2)) return;
							let uv_2 = face2.uv[vkey2]
							let distance = Math.sqrt(Math.pow(uv_2[0] - uv_1[0], 2), Math.pow(uv_2[1] - uv_1[1], 2))
							if (distance < distance_b) {
								closest_from_face_2 = vkey2;
								distance_b = distance;
							}
						})
						face2_used_vkeys.push(face2_used_vkeys);
						return {
							vkey1: vkey,
							vkey2: closest_from_face_2,
							distance: distance_b
						}
					})
					vertex_distances.sort((a, b) => a.distance - b.distance);
					connection_edge_1 = [vertex_distances[0].vkey1, vertex_distances[1].vkey1];
					connection_edge_2 = [vertex_distances[0].vkey2, vertex_distances[1].vkey2];
				}

				// Fix angle
				let angle1 = Math.PI + Math.atan2(
					face1.uv[connection_edge_1[0]][1] - face1.uv[connection_edge_1[1]][1],
					face1.uv[connection_edge_1[0]][0] - face1.uv[connection_edge_1[1]][0],
				);
				let angle2 = Math.PI + Math.atan2(
					face2.uv[connection_edge_2[0]][1] - face2.uv[connection_edge_2[1]][1],
					face2.uv[connection_edge_2[0]][0] - face2.uv[connection_edge_2[1]][0],
				);
				let angle_total = (angle1 - angle2 + Math.PI*6) % (Math.PI*2);
				let sin = Math.sin(angle_total);
				let cos = Math.cos(angle_total);
				selected_faces.forEach(fkey => {
					let face = mesh.faces[fkey];
					if (!face || face == face1) return;
					face.vertices.forEach(vkey => {
						if (!face.uv[vkey]) return;
						face.uv[vkey][0] = (face.uv[vkey][0] * cos - face.uv[vkey][1] * sin);
						face.uv[vkey][1] = (face.uv[vkey][0] * sin + face.uv[vkey][1] * cos);
					})
				})

				// Fix offset
				let offset = [
					face1.uv[connection_edge_1[0]][0] - face2.uv[connection_edge_2[0]][0],
					face1.uv[connection_edge_1[0]][1] - face2.uv[connection_edge_2[0]][1]
				];
				selected_faces.forEach(fkey => {
					let face = mesh.faces[fkey];
					if (!face || face == face1) return;
					face.vertices.forEach(vkey => {
						if (!face.uv[vkey]) return;
						face.uv[vkey][0] = face.uv[vkey][0] + offset[0];
						face.uv[vkey][1] = face.uv[vkey][1] + offset[1];
						if (UVEditor.isUVClamped()) {
							face.uv[vkey][0] = Math.clamp(face.uv[vkey][0], 0, Project.texture_width);
							face.uv[vkey][1] = Math.clamp(face.uv[vkey][1], 0, Project.texture_height);
						}
					})
				})

				mesh.preview_controller.updateUV(mesh);
			})
			UVEditor.loadData();
			Undo.finishEdit('Connect UV faces');
		}
	})
	new Action('snap_uv_to_pixels', {
		icon: 'grid_goldenratio',
		category: 'uv',
		condition: () => Modes.edit && UVEditor.isFaceUV() && UVEditor.hasElements(),
		click: function (event) {
			let elements = UVEditor.getMappableElements();
			Undo.initEdit({elements, uv_only: true})
			elements.forEach(element => {
				let selected_vertices = element instanceof Mesh && element.getSelectedVertices();
				UVEditor.getSelectedFaces(element).forEach(fkey => {
					if (!element.faces[fkey]) return;
					let face = element.faces[fkey];
					let texture = face.getTexture();
					let res_x = 1, res_y = 2;
					if (texture) {
						res_x = texture.getUVWidth() / texture.width;
						res_y = texture.getUVHeight() / texture.display_height;
					}
					if (element instanceof Mesh) {
						face.vertices.forEach(vkey => {
							if ((!selected_vertices.length || selected_vertices.includes(vkey)) && face.uv[vkey]) {
								face.uv[vkey][0] = Math.round(face.uv[vkey][0] / res_x) * res_x;
								face.uv[vkey][1] = Math.round(face.uv[vkey][1] / res_y) * res_y;
                                if (UVEditor.isUVClamped()) {
                                    face.uv[vkey][0] = Math.clamp(face.uv[vkey][0], 0, UVEditor.getUVWidth());
                                    face.uv[vkey][1] = Math.clamp(face.uv[vkey][1], 0, UVEditor.getUVHeight());
                                }
							}
						})
					} else if (face instanceof CubeFace) {
						face.uv[0] = Math.round(face.uv[0] / res_x) * res_x;
						face.uv[1] = Math.round(face.uv[1] / res_y) * res_y;
						face.uv[2] = Math.round(face.uv[2] / res_x) * res_x;
						face.uv[3] = Math.round(face.uv[3] / res_y) * res_y;
                        if (UVEditor.isUVClamped()) {
                            face.uv[0] = Math.clamp(face.uv[0], 0, UVEditor.getUVWidth());
                            face.uv[1] = Math.clamp(face.uv[1], 0, UVEditor.getUVHeight());
                            face.uv[2] = Math.clamp(face.uv[2], 0, UVEditor.getUVWidth());
                            face.uv[3] = Math.clamp(face.uv[3], 0, UVEditor.getUVHeight());
                        }
					}
				})
				element.preview_controller.updateUV(element);
			})
			UVEditor.loadData();
			Undo.finishEdit('Snap UV to pixel grid')
		}
	})
	new Action('uv_cycle', {
		icon: 'fa-arrows-spin',
		category: 'uv',
		condition: () => Modes.edit && Mesh.hasSelected(),
		click(event) {
			let elements = Mesh.selected;
			Undo.initEdit({elements, uv_only: true})
			elements.forEach(element => {
				UVEditor.getSelectedFaces(element).forEach(fkey => {
					let face = element.faces[fkey];
					if (!face || face.vertices.length < 3) return;
					let first_uv;
					let sorted_vertices = face.getSortedVertices();
					let offset = (event?.shiftKey || Pressing.overrides.shift) ? -1 : 1;
					sorted_vertices[offset == 1 ? 'forEach' : 'forEachReverse']((vkey, i) => {
						if (!first_uv) first_uv = face.uv[vkey];
						let vkey_next = sorted_vertices[i + offset];
						face.uv[vkey] = vkey_next ? face.uv[vkey_next] : first_uv;
					})
				})
				element.preview_controller.updateUV(element);
			})
			UVEditor.loadData();
			Undo.finishEdit('Cycle UV')
		}
	})
	new Action('uv_cycle_invert', {
		icon: 'fa-group-arrows-rotate',
		category: 'uv',
		condition: () => Modes.edit && Mesh.hasSelected(),
		click(event) {
			let elements = Mesh.selected;
			Undo.initEdit({elements, uv_only: true})
			elements.forEach(element => {
				UVEditor.getSelectedFaces(element).forEach(fkey => {
					let face = element.faces[fkey];
					if (!face || face.vertices.length < 3) return;
					let sorted_vertices = face.getSortedVertices();
					let last_i = sorted_vertices.length-1;
					let uv1 = face.uv[sorted_vertices[1]];
					face.uv[sorted_vertices[1]] = face.uv[sorted_vertices[last_i]];
					face.uv[sorted_vertices[last_i]] = uv1;
				})
				element.preview_controller.updateUV(element);
			})
			UVEditor.loadData();
			Undo.finishEdit('Cycle reverse UV')
		}
	})
	new Toggle('edit_mode_uv_overlay', {
		icon: 'stack',
		category: 'uv',
		condition: {modes: ['edit']},
		default: settings.display_uv.value == 'all_elements',
		onChange(toggle_value) {
			let value = toggle_value ? 'all_elements' : 'selected_elements';
			UVEditor.vue.display_uv = value;
			settings.display_uv.set(value);
			UVEditor.vue.updateElementOutlines();
		}
	})
	new Toggle('paint_mode_uv_overlay', {
		icon: 'stack',
		category: 'uv',
		condition: {modes: ['paint'], method: () => !Format.image_editor},
		save_on_restart: true,
		onChange(value) {
			UVEditor.vue.uv_overlay = value;
		}
	})
	new Toggle('move_texture_with_uv', {
		icon: 'fas.fa-link',
		category: 'uv',
		condition: {modes: ['edit']}
	})
})


Interface.definePanels(function() {

	UVEditor.panel = new Panel('uv', {
		icon: 'photo_size_select_large',
		expand_button: true,
		condition: {modes: ['edit', 'paint'], method: () => !Format.image_editor},
		display_condition: () => UVEditor.hasElements() || TextureMesh.selected.length > 0 || Modes.paint,
		default_position: {
			slot: 'left_bar',
			float_position: [300, 0],
			float_size: [500, 600],
			height: 500,
			sidebar_index: 1,
		},
		min_height: 200,
		resizable: true,
		toolbars: [
			new Toolbar('uv_editor', {
				children: [
					'move_texture_with_uv',
					'uv_apply_all',
					'uv_maximize',
					'uv_auto',
					'uv_project_from_view',
					'uv_transparent',
					'uv_mirror_x',
					'uv_mirror_y',
					'uv_rotation',
					//Box
					'toggle_mirror_uv',
				]
			})
		],
		onResize: function() {
			UVEditor.vue.hidden = Format.image_editor ? false : !this.isVisible();
			Vue.nextTick(() => {
				UVEditor.vue.updateSize();
			})
		},
		onFold: function() {
			Vue.nextTick(() => {
				if (!this.folded) UVEditor.loadData();
				UVEditor.vue.hidden = Format.image_editor ? false : !this.isVisible();
			})
		},
		component: UVEditorPanel
	})
	Object.defineProperty(UVEditor.panel, 'icon', {
		get() {
			return Modes.paint ? 'note_alt' : 'photo_size_select_large'
		},
	})
	UVEditor.panel.on('move_to', (data) => {
		if (!Blockbench.isMobile) {
			UVEditor.saveViewportOffset();
		}
	})
	UVEditor.panel.on('moved_to', (data) => {
		Vue.nextTick(() => {
			UVEditor.loadViewportOffset();
		})
	})

	Blockbench.on('update_pressed_modifier_keys', ({before, now}) => {
		if (before.shift != now.shift && document.querySelector('#uv_viewport:hover')) {
			let active = now.shift;
			if (Painter.current.x == undefined) active = false;
			if (UVEditor.vue.mouse_coords.line_preview && !active) {
				Blockbench.setStatusBarText();
			}
			UVEditor.vue.mouse_coords.line_preview = active;
		}
	});

	Toolbars.uv_editor.toPlace()

	BarItems.paint_mode_uv_overlay.toElement('#toggle_uv_overlay_anchor');
	BarItems.edit_mode_uv_overlay.toElement('#toggle_edit_uv_overlay_anchor');

	let {slider_bar} = UVEditor.vue.$refs;

	var onBefore = function() {
		Undo.initEdit({elements: UVEditor.getMappableElements()})
	}
	var onAfter = function() {
		Undo.finishEdit('Edit UV')
	}
	var getInterval = function(event) {
		if (UVEditor.isBoxUV()) {
			return 1;
		} else {
			return canvasGridSize(event.shiftKey || Pressing.overrides.shift, event.ctrlOrCmd || Pressing.overrides.ctrl) / UVEditor.grid;
		}
	}
	UVEditor.sliders.pos_x = new NumSlider({
		id: 'uv_slider_pos_x',
		private: true,
		condition: () => UVEditor.hasElements() && (UVEditor.getReferenceFace() || UVEditor.isBoxUV()),
		get() {
			return trimFloatNumber(UVEditor.getFacePosition(0));
		},
		change: function(modify) {
			UVEditor.slidePos(modify, 0);
		},
		getInterval,
		onBefore,
		onAfter
	}).toElement(slider_bar);

	UVEditor.sliders.pos_y = new NumSlider({
		id: 'uv_slider_pos_y',
		private: true,
		condition: () => UVEditor.hasElements() && (UVEditor.getReferenceFace() || UVEditor.isBoxUV()),
		get() {
			return trimFloatNumber(UVEditor.getFacePosition(1));
		},
		change: function(modify) {
			UVEditor.slidePos(modify, 1);
		},
		getInterval,
		onBefore,
		onAfter
	}).toElement(slider_bar);

	UVEditor.sliders.size_x = new NumSlider({
		id: 'uv_slider_size_x',
		private: true,
		condition: () => (UVEditor.hasElements() && UVEditor.isFaceUV() && UVEditor.getReferenceFace()),
		get() {
			return trimFloatNumber(UVEditor.getFaceSize(0));
		},
		change: function(modify) {
			UVEditor.slideSize(modify, 0)
		},
		getInterval,
		onBefore,
		onAfter
	}).toElement(slider_bar);

	UVEditor.sliders.size_y = new NumSlider({
		id: 'uv_slider_size_y',
		private: true,
		condition: () => (UVEditor.hasElements() && UVEditor.isFaceUV() && UVEditor.getReferenceFace()),
		get() {
			return trimFloatNumber(UVEditor.getFaceSize(1));
		},
		change: function(modify) {
			UVEditor.slideSize(modify, 1)
		},
		getInterval,
		onBefore,
		onAfter

	}).toElement(slider_bar);
	BarItems.edit_mode_uv_overlay.toElement(slider_bar);
})


Object.assign(window, {
	UVEditor
});
