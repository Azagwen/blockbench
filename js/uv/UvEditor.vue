<template>
	<div class="UVEditor" ref="main" :class="{checkerboard_trigger: checkerboard}" id="UVEditor">

		<div class="bar next_to_title" id="uv_title_bar">
			<div id="uv_resolution_status" @click="projectResolution()">
				{{ uv_resolution[0] + ' ⨉ ' + uv_resolution[1] }}
			</div>
		</div>

		<div class="bar" id="uv_cube_face_bar" ref="uv_cube_face_bar" v-if="mode == 'uv' && mappable_elements[0] && mappable_elements[0].getTypeBehavior('select_faces') && !box_uv">
			<li v-for="(face, key) in mappable_elements[0].faces" :face="key"
				:class="{selected: isFaceSelected(null, key), disabled: mappable_elements[0].faces[key].texture === null}"
				@mousedown="selectFace(null, key, $event, false, true)"
			>
				{{ face_names[key] }}
			</li>
			<li @click="mode = 'face_properties'" class="tool face_properties_toggle">
				<div class="tooltip">{{tl('uv_editor.face_properties')}}</div>
				<i class="material-icons">checklist</i>
			</li>
		</div>


		<div id="uv_face_properties" v-if="mode === 'face_properties'">
			<div class="bar" id="face_properties_header_bar">
				<li></li>
				<li @click="mode = 'uv'" class="tool face_properties_toggle">
					<i class="material-icons">clear</i>
				</li>
			</div>

			<div class="uv_face_properties_labels">
					
				<label style="width: 76px;">Enabled</label>

				<label style="width: 120px;" class="flexible">Texture</label>

				<template v-if="checkFormat({java_face_properties: true})">
					<label style="width: 58px;" @click="showInfoBox('action.face_tint', 'uv_editor.tint.info')" :title="tl('uv_editor.tint.info')">
						{{ tl('action.face_tint') }}
						<i class="material-icons">info</i>
					</label>
				</template>

				<template v-if="checkFormat({cullfaces: true})">
					<label style="width: 50px;" @click="showInfoBox('action.cullface', 'uv_editor.cullface.info')" :title="tl('uv_editor.cullface.info')" class="flexible">
						{{ tl('action.cullface') }}
						<i class="material-icons">info</i>
					</label>
				</template>

				<template v-if="checkFormat({id: 'bedrock_block'})">
					<label style="width: 100px;" class="flexible" @click="showInfoBox('uv_editor.face_properties.material_instance', 'uv_editor.material_instance.info')" :title="tl('uv_editor.material_instance.info')">
						{{ tl('uv_editor.face_properties.material_instance') }}
						<i class="material-icons">info</i>
					</label>
				</template>
			</div>


			<ul v-if="mappable_elements[0] && mappable_elements[0].getTypeBehavior('select_faces') == 'enum'">
				<li v-for="(face, key) in mappable_elements[0].faces" :face="key"
					class="uv_face_properties_line"
					:class="{selected: isFaceSelected(mappable_elements[0], key), disabled: mappable_elements[0].faces[key].texture === null}"
					@pointerdown="selectFace(mappable_elements[0], key, $event, false, true)"
				>
					
					<input type="checkbox" :checked="mappable_elements[0].faces[key].texture !== null" @change="toggleFaceEnabled(key, $event)" @pointerdown.stop>

					<label>{{ face_names[key] }}</label>

					<div class="face_properties_texture" :face_texture="face_texture = mappable_elements[0].faces[key].getTexture()" @click="openFaceTextureMenu($event)">
						<img :src="face_texture.source" class="texture_icon" width="32px" height="32px" alt="" v-if="face_texture && face_texture.show_icon" />
						<div class="texture_dummy_icon" v-else></div>
						{{ face_texture ? face_texture.name : tl('menu.cube.texture.blank') }}
					</div>

					<template v-if="checkFormat({java_face_properties: true})">
						<div style="width: 58px; display: flex;">
							<input type="checkbox" :title="$l(action.face_tint)" :checked="mappable_elements[0].faces[key].tint > -1" @change="toggleFaceTint(key, $event)">
							<input type="number" :title="$l(action.face_tint)" style="width: 30px;" :value="mappable_elements[0].faces[key].tint" min="0" step="1" @input="changeFaceTint(key, $event)" v-if="mappable_elements[0].faces[key].tint > -1">
						</div>
					</template>

					<template v-if="checkFormat({cullfaces: true})">
						<select-input class="flexible" :title="tl('action.cullface')" :value="mappable_elements[0].faces[key].cullface" @input="setCullface(key, $event)" :options="cullface_options" />
					</template>

					<template v-if="checkFormat({id: 'bedrock_block'})">
						<input type="text" style="width: 100px;" class="flexible dark_bordered"
							:title="tl('uv_editor.face_properties.material_instance')"
							v-model="mappable_elements[0].faces[key].material_name"
							@focus="startInputMaterialInstance($event)"
							@focusout="endInputMaterialInstance($event, key)"
						>
					</template>
				</li>
			</ul>
		</div>


		<canvas
			id="uv_element_outlines"
			ref="uvCanvas"
		></canvas>

		<div id="uv_viewport"
			class="checkerboard_target"
			:class="{tiled_mode: overlay_canvas_mode == 'tiled'}"
			ref="viewport"
			@contextmenu="contextMenu($event)"
			@pointerdown="onPointerDown($event)"
			@touchstart="onTouchStart($event)"
			@touchend="onTouchEnd($event)"
			@wheel="onMouseWheel($event)"
			@scroll="onScroll($event)"
			@mousemove="updateMouseCoords($event)"
			@mouseenter="onMouseEnter($event)"
			@mouseleave="onMouseLeave($event)"
			v-if="!hidden && mode !== 'face_properties'"
			:style="{width: (width+8) + 'px', height: (height+8) + 'px', overflowX: (zoom > 1) ? 'scroll' : 'hidden', overflowY: (inner_height > height) ? 'scroll' : 'hidden'}"
		>

			<div id="uv_background" :style="{
				padding: (getFrameMargin()[1]) + 'px ' + (getFrameMargin()[0]) + 'px',
				width: (inner_width + 8 + getFrameMargin()[0]*2)+'px',
				height: (inner_height + 8 + getFrameMargin()[1]*2)+'px',
			}"></div>

			<div id="uv_frame" ref="frame"
				v-if="texture !== null"
				@click.stop="reverseSelect($event)"
				:class="{overlay_mode: uv_overlay && mode == 'paint'}"
				:style="{width: inner_width + 'px', height: inner_height + 'px', margin: getFrameMargin(true), '--inner-width': inner_width + 'px', '--inner-height': inner_height + 'px'}"
			>

				<div id="uv_selection_frame" v-if="mode == 'uv' && isScalingAvailable()" :style="getUVSelectionFrameStyle()">
					<div id="uv_rotate_handle" v-if="isRotatingAvailable()"
						@mousedown.stop="rotateFace($event)" @touchstart.prevent.stop="rotateFace($event)"
						:title="tl('uv_editor.rotate_uv')"
					>
						<i class="material-icons">rotate_right</i>
					</div>
					
					<div id="uv_scale_handle" v-if="isScalingAvailable()"
						@mousedown.stop="scaleFaces($event)" @touchstart.prevent.stop="scaleFaces($event)"
						:title="tl('uv_editor.scale_uv')"
					>
						<i class="fa fa-solid fa-square-up-right"></i>
					</div>
				</div>

				<div class="selection_rectangle"
					v-if="selection_rect.active"
					:style="{
						left: toPixels(selection_rect.pos_x),
						top: toPixels(selection_rect.pos_y),
						width: toPixels(selection_rect.width),
						height: toPixels(selection_rect.height),
					}">
				</div>
				

				<div v-if="helper_lines.x >= 0" class="uv_helper_line_x" :style="{left: toPixels(helper_lines.x)}"></div>
				<div v-if="helper_lines.y >= 0" class="uv_helper_line_y" :style="{top: toPixels(helper_lines.y)}"></div>

				<div id="uv_brush_outline" v-if="mode == 'paint' && mouse_coords.active" :class="['brush_outline', brush_type]" :style="getBrushOutlineStyle()">
					<div v-if="mouse_coords.line_preview" id="uv_brush_line_preview" :style="getLinePreviewStyle()"></div>
				</div>

				<div id="uv_copy_brush_outline" v-if="copy_brush_source && texture && texture.uuid == copy_brush_source.texture" :style="getCopyBrushOutlineStyle()"></div>

				<div ref="texture_canvas_wrapper" id="texture_canvas_wrapper" :key="'texture_canvas_wrapper'" v-show="texture && texture.error != 1"></div>
				<img style="object-fit: fill; opacity: 0.02; mix-blend-mode: screen;" v-if="texture == 0 && !box_uv" src="./assets/missing_blend.png">

				<svg id="uv_tiling_grid" viewBox="0 0 3 3" preserveAspectRatio="none" v-if="tiling_grid && isTilingVisible()">
					<path d="M1 0V3M2 0V3M0 1H3M0 2H3" />
				</svg>

				<svg id="uv_texture_grid" v-if="pixel_grid && mode == 'paint' && texture && texture.width">
					<path :d="textureGrid" :style="{strokeWidth: textureGridStroke}" />
					<path :d="textureGridBold" class="bold_grid" />
				</svg>

				<div class="uv_layer_transform_handles"
					v-if="isTransformingLayer()"
					:style="{
						left: toTexturePixels(layer.offset[0], 0, 0),
						top: toTexturePixels(layer.offset[1], 1, 0),
						width: toTexturePixels(layer.scaled_width, 2, 0),
						height: toTexturePixels(layer.scaled_height, 3, 0),
					}"
				>
					<div class="uv_resize_corner uv_c_nw" @pointerdown="resizeLayer($event, -1, -1)" style="left: 0; top: 0;" />
					<div class="uv_resize_corner uv_c_ne" @pointerdown="resizeLayer($event, 1, -1)" style="right: 0; top: 0;" />
					<div class="uv_resize_corner uv_c_sw" @pointerdown="resizeLayer($event, -1, 1)" style="left: 0; bottom: 0;" />
					<div class="uv_resize_corner uv_c_se" @pointerdown="resizeLayer($event, 1, 1)" style="right: 0; bottom: 0;" />

					<div class="uv_resize_corner uv_c_n" @pointerdown="resizeLayer($event, 0, -1)" style="top: 0; left: 50%;" />
					<div class="uv_resize_corner uv_c_s" @pointerdown="resizeLayer($event, 0, 1)" style="bottom: 0; left: 50%;" />
					<div class="uv_resize_corner uv_c_w" @pointerdown="resizeLayer($event, -1, 0)" style="left: 0; top: 50%;" />
					<div class="uv_resize_corner uv_c_e" @pointerdown="resizeLayer($event, 1, 0)" style="right: 0; top: 50%;" />
				</div>

				<div id="texture_selection_rect"
					v-if="texture_selection_rect.active"
					:class="{ellipse: texture_selection_rect.ellipse}"
					:style="{
						left: toTexturePixels(texture_selection_rect.pos_x, 0, 0),
						top: toTexturePixels(texture_selection_rect.pos_y, 1, 0),
						width: toTexturePixels(texture_selection_rect.width, 2, 0),
						height: toTexturePixels(texture_selection_rect.height, 3, 0),
					}">
				</div>

				<svg id="texture_selection_polygon" v-if="texture_selection_polygon.length">
					<path :d="getTextureSelectionPolygon()" />
					<circle :cx="texture_selection_polygon[0][0] / texture.width * inner_width + 1" :cy="texture_selection_polygon[0][1] / texture.width * inner_width + 1" r="7" :class="{closed: isSelectionPolygonClosed()}" />
				</svg>

				<svg id="uv_selection_outline" v-if="mode == 'paint'">
					<path :d="selection_outline" />
					<path :d="selection_outline" class="dash_overlay" />
				</svg>
			</div>

			<div class="uv_navigator" @click="focusOnSelection($event)" v-show="mode == 'uv'">
				<i class="material-icons icon">navigation</i>
			</div>

			<div class="uv_transparent_face" v-if="showTransparentFaceText()">${tl('uv_editor.transparent_face')}</div>
		</div>

		<div class="uv_layer_limbo_options" v-if="isTransformingLayer()">
			<template v-if="texture && layer && layer.in_limbo">
				<button @click="layer.resolveLimbo(true)">${tl('uv_editor.copy_paste_tool.to_layer')}</button>
				<button @click="layer.resolveLimbo(false)">${tl('uv_editor.copy_paste_tool.place')}</button>
			</template>
			<button v-else-if="layer.scale[0] != 1 || layer.scale[1] != 1" @click="layer.resolveLimbo(true)">${tl('dialog.scale.confirm')}</button>
		</div>

		<div v-show="mode == 'paint'" class="bar uv_painter_info">
			<div v-if="texture && layer && layer.in_limbo" ref="copy_paste_tool_control" class="copy_paste_tool_control">
				<div class="tool button_mirror_x" @click="layer.flip(0, true)"><div class="tooltip">${tl('uv_editor.copy_paste_tool.mirror_x')}</div><i class="icon-mirror_x icon"></i></div>
				<div class="tool button_mirror_y" @click="layer.flip(1, true)"><div class="tooltip">${tl('uv_editor.copy_paste_tool.mirror_y')}</div><i class="icon-mirror_y icon"></i></div>
				<div class="tool button_rotate" @click="layer.rotate(90, true)"><div class="tooltip">${tl('uv_editor.copy_paste_tool.rotate')}</div><i class="material-icons">rotate_right</i></div>
			</div>

			<template v-else>
				<span style="color: var(--color-subtle_text);">{{ getBrushPositionText() }}</span>
				<span v-if="texture" class="uv_panel_texture_name" @click="selectTextureMenu($event)">{{ texture.name }}</span>
				<span style="color: var(--color-subtle_text);">{{ Math.round(this.zoom*100).toString() + '%' }}</span>
			</template>

			<div id="toggle_uv_overlay_anchor"></div>
		</div>

		<div :class="{joined_uv_bar: width >= 720}" ref="uv_toolbars">
			<div v-show="mode == 'uv'" class="bar uv_editor_sliders" ref="slider_bar" style="margin-left: 2px;"></div>
			<div v-show="mode == 'uv'" class="toolbar_wrapper uv_editor" toolbar="uv_editor"></div>
		</div>
	</div>
</template>

<script lang="js">
import { dragHelper } from "../util/drag_helper";
import { editUVSizeDialog } from "./uv_size";

export default {
	data() {return {
		mode: 'uv',
		hidden: false,
		box_uv: false,
		cube_uv_rotation: true,
		width: 320,
		height: 320,
		zoom: 1,
		centered_view: true,
		checkerboard: settings.uv_checkerboard.value,
		pixel_grid: settings.painting_grid.value,
		tiling_grid: false,
		uv_overlay: BarItems.paint_mode_uv_overlay.value,
		texture: 0,
		layer: null,
		mouse_coords: {x: -1, y: -1, active: false, line_preview: false},
		touches_count: 0,
		last_brush_position: [0, 0],
		copy_brush_source: null,
		helper_lines: {x: -1, y: -1},
		brush_type: BarItems.brush_shape.value,
		overlay_canvas_mode: null,
		selection_rect: {
			pos_x: 0,
			pos_y: 0,
			width: 0,
			height: 0,
			active: false
		},
		texture_selection_rect: {
			pos_x: 0,
			pos_y: 0,
			width: 0,
			height: 0,
			active: false,
			ellipse: false
		},
		texture_selection_polygon: [],

		uv_resolution: [16, 16],
		elements: [],
		all_elements: [],
		display_uv: settings.display_uv.value,
		selection_outline: '',

		face_names: {
			north: tl('face.north'),
			south: tl('face.south'),
			west: tl('face.west'),
			east: tl('face.east'),
			up: tl('face.up'),
			down: tl('face.down'),
		},
		cullface_options: {
			'': tl('uv_editor.no_faces'),
			north: tl('face.north'),
			south: tl('face.south'),
			west: tl('face.west'),
			east: tl('face.east'),
			up: tl('face.up'),
			down: tl('face.down'),
		},

		rendered_faces: [],
		custom_render_channels: []
	}},
	computed: {
		inner_width() {
			let axis = this.applicable_aspect_ratio < this.width / this.height;
			if (axis) {
				return this.height * this.zoom * (this.applicable_aspect_ratio);
			} else {
				return this.width * this.zoom;
			}
		},
		inner_height() {
			return Math.min(this.height * this.zoom, this.width * this.zoom / (this.applicable_aspect_ratio));
		},
		applicable_aspect_ratio() {
			if (this.mode == 'paint' && this.texture && this.texture.width) {
				return this.texture.width / this.texture.display_height;
			} else {
				return this.uv_resolution[0] / this.uv_resolution[1];
			}
		},
		mappable_elements() {
			return this.elements.filter(element => element.faces && !element.locked);
		},
		all_mappable_elements() {
			return this.all_elements.filter(element => element.faces && !element.locked);
		},
		textureGrid() {
			if (!this.texture) return '';
			let lines = [];
			let size = UVEditor.getTexturePixelSize();
			if (size <= 5) return '';
			// =
			for (let y = 1; y < this.texture.display_height; y++) {
				if (y % 16 == 0) continue;
				lines.push(`M${0} ${y*size} L${this.inner_width} ${y*size}`);
			}
			// ||
			for (let x = 1; x < this.texture.width; x++) {
				if (x % 16 == 0) continue;
				lines.push(`M${x*size} ${0} L${x*size} ${this.inner_height}`);
			}
			return lines.join(' ');
		},
		textureGridStroke() {
			if (!this.texture) return '';
			let size = UVEditor.getTexturePixelSize();
			return Math.clamp((size - 4) / 16, 0, 0.4) + 'px';
		},
		textureGridBold() {
			if (!this.texture) return '';
			let lines = [];
			let size = UVEditor.getTexturePixelSize();
			let interval = settings.image_editor_grid_size.value;
			// =
			for (let y = interval; y < this.texture.display_height; y += interval) {
				lines.push(`M${0} ${y*size} L${this.inner_width} ${y*size}`);
			}
			// ||
			for (let x = interval; x < this.texture.width; x += interval) {
				lines.push(`M${x*size} ${0} L${x*size} ${this.inner_height}`);
			}
			return lines.join(' ');
		}
	},
	watch: {
		elements() {
			Vue.nextTick(() => {
				this.updateSize(); // Update size to reflect different UI parts being visible depending on selection
			})
		},
		texture() {
			this.uv_resolution.splice(0, 2,
				UVEditor.getUVWidth(),
				UVEditor.getUVHeight()
			);
		},
		'texture.uv_width'(value) {
			this.uv_resolution.splice(0, 2,
				UVEditor.getUVWidth(),
				UVEditor.getUVHeight()
			);
		},
		'texture.uv_height'(value) {
			this.uv_resolution.splice(0, 2,
				UVEditor.getUVWidth(),
				UVEditor.getUVHeight()
			);
		},
		mode() {
			Vue.nextTick(() => {
				this.updateSize();
			})
		}
	},
	methods: {
		tl,
		// TODO: Re-add edge and point dragging on cube faces
		// TODO: Re-add mesh faces
		// TODO: Add spline UV, and hooks for custom UVs
		tickOutlineCanvas() {
			let canvas = this.$refs.uvCanvas;
			let viewport = this.$refs.viewport;
			let frame = this.$refs.frame;
			let ctx = canvas.getContext("2d");

			// console.log(`(${mouseX}, ${mouseY}), (${viewportLeft}, ${viewportTop})`);
			let viewportLeft = this.getFrameMargin()[0] + 4 - viewport.scrollLeft;
			let viewportTop = this.getFrameMargin()[1] + 4 - viewport.scrollTop;
			let canvasWidth = canvas.clientWidth;
			let canvasHeight = canvas.clientHeight;
			let canvasLeft = canvas.clientLeft;
			let canvasTop = canvas.clientTop;
			let panelTransform = {
				canvas: {
					width: canvasWidth,
					height: canvasHeight,
					left: canvasLeft,
					top: canvasTop,
					right: canvasLeft + canvasWidth,
					bottom: canvasTop + canvasHeight
				},
				viewport: {
					left: viewportLeft,
					top: viewportTop
				},
				mouse: {
					x: this.toPixelValue(this.mouse_coords.x) + viewportLeft + 0.5,
					y: this.toPixelValue(this.mouse_coords.y) + viewportTop + 0.5
				}
			}

			let viewportStyle = window.getComputedStyle(frame);
			let frameStyle = window.getComputedStyle(frame);
			let faceStyle = {
				outline: {
					widthBase: parseInt(frameStyle.getPropertyValue("--uv-line-width").trim(), 10),
					widthHover: parseInt(frameStyle.getPropertyValue("--uv-line-width-hovered").trim(), 10),
					base: frameStyle.getPropertyValue("--color-text").trim(),
					hover: frameStyle.getPropertyValue("--color-uv-hover").trim(),
					selected: frameStyle.getPropertyValue("--color-accent").trim(),
					unselected: frameStyle.getPropertyValue("--color-uv-unselected").trim()
				},
				background: {
					base: frameStyle.getPropertyValue("--color-uv-background").trim(),
					hover: frameStyle.getPropertyValue("--color-uv-background-hover").trim()
				},
				dot: {
					radius: 5,
					outline: "black",
					background: "white"
				},
				text: {
					base: frameStyle.getPropertyValue("--color-subtle_text").trim()
				}
			}

			// Scale Canvas
			canvas.width = this.width + 8;
			canvas.height = this.height + 8;
			
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			if (!this.getDisplayedUVElements().length) return;
			this.rendered_faces = [];
			this.drawCubeFaces(ctx, panelTransform, faceStyle);
			this.custom_render_channels.forEach(f => f(ctx, panelTransform, faceStyle));
		},
		getFaceCullInfo(top, left, bottom, right, canvasTransform) {
			// make sure we don't hide very wide faces if both 
			// sides are out of frame on opposite ends of one axis.
			// - 0 and + 0 are leftovers from culling early, 
			// this was aborted due to corners culling too soon
			let cullLeftMin = ((left - 0) < canvasTransform.left);
			let cullTopMin = ((top - 0) < canvasTransform.top);
			let cullRightMin = ((right - 0) < canvasTransform.left);
			let cullBottomMin = ((bottom - 0) < canvasTransform.top);

			let cullLeftMax = ((left + 0) > canvasTransform.right);
			let cullTopMax = ((top + 0) > canvasTransform.bottom);
			let cullRightMax = ((right + 0) > canvasTransform.right);
			let cullBottomMax = ((bottom + 0) > canvasTransform.bottom);

			return {
				left: (cullLeftMin && !cullRightMax) || cullLeftMax,
				top: (cullTopMin && !cullBottomMax) || cullTopMax,
				right: cullRightMin || (cullRightMax && !cullLeftMin),
				bottom: cullBottomMin || (cullBottomMax && !cullTopMin)
			};
		},
		isFaceHovered(top, left, bottom, right, mouseTransform) {
			// Check if this face is under the mouse
			let isMouseOverOnX = (mouseTransform.x >= left) && (mouseTransform.x <= right);
			let isMouseOverOnY = (mouseTransform.y >= top) && (mouseTransform.y <= bottom);
			return isMouseOverOnX && isMouseOverOnY
		},
		// https://iquilezles.org/articles/distfunctions2d/
		// float sdSegment( in vec2 p, in vec2 a, in vec2 b )
		// {
		//     vec2 pa = p-a, ba = b-a;
		//     float h = clamp( dot(pa,ba)/dot(ba,ba), 0.0, 1.0 );
		//     return length( pa - ba*h );
		// }
		isEdgeHovered(mouse, start, end, threshold) {
			let p = [...mouse];
			let a = [...start];
			let b = [...end];

		    let pa = p.V2_subtract(a);
			let ba = b.V2_subtract(a);
			let dot_pa = (pa[0] * ba[0]) + (pa[1] * ba[1]);
			let dot_ba = (ba[0] * ba[0]) + (ba[1] * ba[1]);
		    let h = Math.clamp(dot_pa / dot_ba, 0.0, 1.0);
			let sdf = pa.V2_subtract(ba.V2_multiply(h)).V2_length();
		    return {
				isHover: (sdf - threshold) < 0.0,
				proximity: sdf
			};
		},
		drawCubeFaces(ctx, panelTransform, style) {
			// console.log(ctx); 
			let highlightedFaces = [];
			for(let element of this.getDisplayedUVElements()) {
				// Cube face
				if(element.getTypeBehavior('cube_faces')) {
					for(let [key, face] of Object.entries(element.faces)) {
						let hasTexture = (face.getTexture() == this.texture || this.texture == 0) && face.texture !== null;
						let showAllFaces = this.display_uv !== 'selected_faces';
						let isPainting = this.mode == 'paint';
						let isSelected = this.isFaceSelected(element, key);
						let canSelectFace = (showAllFaces || isPainting || isSelected || element.getTypeBehavior('select_faces') == false);

						if(hasTexture && canSelectFace) {
							let expectedLeft = this.toPixelValue(Math.min(face.uv[0], face.uv[2])) + panelTransform.viewport.left;
							let expectedTop = this.toPixelValue(Math.min(face.uv[1], face.uv[3])) + panelTransform.viewport.top;
							let expectedWidth = this.toPixelValue(Math.abs(face.uv_size[0]));
							let expectedHeight = this.toPixelValue(Math.abs(face.uv_size[1]));
							let expectedRight = (expectedLeft + expectedWidth);
							let expectedBottom = (expectedTop + expectedHeight);

							let shouldFaceCull = this.getFaceCullInfo(expectedTop, expectedLeft, expectedBottom, expectedRight, panelTransform.canvas);
							let isFaceHovered = this.isFaceHovered(expectedTop, expectedLeft, expectedBottom, expectedRight, panelTransform.mouse);
							let mouseArr = [panelTransform.mouse.x, panelTransform.mouse.y];
							let topLeft = [expectedLeft, expectedTop];
							let bottomLeft = [expectedLeft, expectedBottom];
							let topRight = [expectedRight, expectedTop];
							let bottomRight = [expectedRight, expectedBottom];
							let hoverRadius = 8.0;
							let edgeHoverDataLeft = this.isEdgeHovered(mouseArr, topLeft   , bottomLeft , hoverRadius);
							let edgeHoverDataRight = this.isEdgeHovered(mouseArr, topRight  , bottomRight, hoverRadius);
							let edgeHoverDataTop = this.isEdgeHovered(mouseArr, topLeft   , topRight   , hoverRadius);
							let edgeHoverDataBottom = this.isEdgeHovered(mouseArr, bottomLeft, bottomRight, hoverRadius);
							let isEdgeHoveredLeft = edgeHoverDataLeft.isHover;
							let isEdgeHoveredRight = edgeHoverDataRight.isHover;
							let isEdgeHoveredTop = edgeHoverDataTop.isHover;
							let isEdgeHoveredBottom = edgeHoverDataBottom.isHover;

							// Finish data
							let faceData = {
								type: "cube",
								element: element,
								left: expectedLeft,
								right: expectedRight,
								top: expectedTop,
								bottom: expectedBottom,
								width: expectedWidth,
								height: expectedHeight,
								hovered: {
									all: isFaceHovered || isEdgeHoveredLeft || isEdgeHoveredRight || isEdgeHoveredTop || isEdgeHoveredBottom,
									left: edgeHoverDataLeft,
									right: edgeHoverDataRight,
									top: edgeHoverDataTop,
									bottom: edgeHoverDataBottom 
								},
								selected: isSelected,
								culling: {
									all: (shouldFaceCull.left && shouldFaceCull.right) || (shouldFaceCull.top && shouldFaceCull.bottom),
									left: shouldFaceCull.left,
									right: shouldFaceCull.right,
									top: shouldFaceCull.top,
									bottom: shouldFaceCull.bottom
								}
							};
							this.rendered_faces.push(faceData);
							if (isSelected || isFaceHovered || isEdgeHoveredLeft || isEdgeHoveredRight || isEdgeHoveredTop || isEdgeHoveredBottom) {
								highlightedFaces.push({...faceData});
							}
						}
					}
				}
			}

			// Draw face outlines
			for (let face of this.rendered_faces) {
				if (face.type == "cube" && !face.culling.all) {
					let left = face.left;
					let top = face.top;
					let width = face.width;
					let height = face.height;
					
					ctx.fillStyle = face.hovered.all ? style.background.hover : style.background.base;
					ctx.lineWidth = style.outline.widthBase;
					ctx.strokeStyle = style.outline.base;

					let showAllElements = this.display_uv === 'all_elements' ;
					let elementNotSelected = !this.mappable_elements.includes(face.element);
					if (face.element.box_uv) {
						ctx.strokeStyle = (showAllElements && elementNotSelected) ? style.outline.unselected : style.outline.selected;
					}

					ctx.fillRect(left, top, width, height);
					ctx.strokeRect(left, top, width, height);
				}
			}

			// Draw selected & hovered face outlines
			for (let face of highlightedFaces) {
				if (face.type == "cube" && !face.element.box_uv && !face.culling.all) {
					let left = face.left;
					let top = face.top;
					let right = face.right;
					let bottom = face.bottom;
					let width = face.width;
					let height = face.height;

					ctx.lineWidth = style.outline.widthBase;
					ctx.strokeStyle = face.hovered.all ? style.outline.base : style.outline.selected;
					ctx.strokeRect(left, top, width, height);
					
					let hoverWidth = style.outline.widthHover;
					let edgeStyle = { thickness: hoverWidth, color: style.outline.base}
					if (face.hovered.left.isHover)   ctx.drawLine([left , top   ], [left , bottom], edgeStyle);
					if (face.hovered.right.isHover)  ctx.drawLine([right, top   ], [right, bottom], edgeStyle);
					if (face.hovered.top.isHover)    ctx.drawLine([left , top   ], [right, top   ], edgeStyle);
					if (face.hovered.bottom.isHover) ctx.drawLine([left , bottom], [right, bottom], edgeStyle);
				}
			}

			// Draw selected face dots
			for (let face of highlightedFaces) {
				if (face.type == "cube" && !face.element.box_uv && face.selected) {
					let left = face.left;
					let right = face.right;
					let top = face.top;
					let bottom = face.bottom;

					let dotStyle = { stroke: style.dot.outline, fill: style.dot.background, thickness: 2 }
					if (!face.culling.left  && !face.culling.top) ctx.drawOutlinedDot(left , top, style.dot.radius, dotStyle);
					if (!face.culling.right && !face.culling.top) ctx.drawOutlinedDot(right, top, style.dot.radius, dotStyle);
					if (!face.culling.right && !face.culling.bottom) ctx.drawOutlinedDot(right, bottom, style.dot.radius, dotStyle);
					if (!face.culling.left  && !face.culling.bottom) ctx.drawOutlinedDot(left , bottom, style.dot.radius, dotStyle);
				}
			}
		},
		isTilingVisible() {
			if (!this.texture) return false;
			return (this.overlay_canvas_mode == 'tiled' && this.mode == 'paint') || (this.texture.wrap_mode == 'repeat' && this.mode == 'uv');
		},
		projectResolution() {
			editUVSizeDialog(Format.per_texture_uv_size ? {texture: UVEditor.texture} : {project: true});
		},
		updateSize() {
			if (!this.$refs.viewport) return;
			let old_size = this.width;
			let size = Format.image_editor
					? Math.floor(Math.clamp(Interface.center_screen.clientWidth - 8, 64, 1e5))
					: Math.floor(Math.clamp(UVEditor.panel.width - 8, 64, 1e5));
			this.width = size;
			if (Format.image_editor) {
				this.height = Interface.preview.clientHeight - 38;

			} else if (Panels.uv.getContainerPanel().slot.includes('_bar') && !UVEditor.panel.fixed_height) {
				this.height = size;

			} else {
				this.height = Math.clamp(
					UVEditor.panel.height
					-UVEditor.panel.tab_bar.clientHeight - 9
					-(this.$refs.uv_cube_face_bar ? this.$refs.uv_cube_face_bar.clientHeight : 0)
					-(this.$refs.uv_toolbars ? this.$refs.uv_toolbars.clientHeight : 0)
					-(this.mode == 'paint' ? 30 : 0),
				64, 1e5);
			}
			this.$refs.viewport.scrollLeft = Math.round(this.$refs.viewport.scrollLeft * (size / old_size));
			this.$refs.viewport.scrollTop  = Math.round(this.$refs.viewport.scrollTop  * (size / old_size));

			if (this.$refs.viewport && this.zoom == 1 && ((!this.$refs.viewport.scrollLeft && !this.$refs.viewport.scrollTop) || this.centered_view)) {
				this.centerView();
			}
			this.updateTextureCanvas();
			UVEditor.updateSelectionOutline(false);
			this.tickOutlineCanvas();
		},
		centerView() {
			if (this.$refs.viewport) {
				this.$refs.viewport.scrollLeft = this.width/2;
				this.$refs.viewport.scrollTop = this.height/2;
				UVEditor.updateUVNavigator();
				this.tickOutlineCanvas();
			}
			this.centered_view = true;
		},
		setMode(mode) {
			this.mouse_coords.active = false;
			this.mode = mode;
			this.updateTexture();
		},
		updateTexture() {
			let texture;
			let texture_meshes = TextureMesh.selected;
			if (texture_meshes.length && !UVEditor.getMappableElements().length) {
				texture = texture_meshes[0].getTexture();
			} else if (Format.single_texture) {
				texture = Texture.getDefault();
			} else {
				let elements = UVEditor.getMappableElements();
				if (elements.length) {
					for (let element of elements) {
						let face = element.faces[ UVEditor.getSelectedFaces(element)[0] || Object.keys(element.faces)[0] ];
						if (face) texture = face.getTexture() || texture;
						if (texture) break;
					}
				} else if (Modes.paint) {
					texture = Texture.getDefault();
				}
			}
			if (texture === null) {
				this.texture = null;
			} else if (texture instanceof Texture && BarItems.view_mode.value == 'material' && texture?.getGroup()?.getTextures()?.includes(Texture.selected)) {
				this.texture = texture = Texture.selected;
				if (!UVEditor.isBoxUV() && UVEditor.auto_grid) {
					UVEditor.grid = texture.width / UVEditor.getUVWidth();
				}
			} else if (texture instanceof Texture) {
				this.texture = texture;
				if (!UVEditor.isBoxUV() && UVEditor.auto_grid) {
					UVEditor.grid = texture.width / UVEditor.getUVWidth();
				}
			} else {
				this.texture = 0;
			}
			this.layer = (this.texture && this.texture.getActiveLayer()) || null;
			// Display canvas while painting
			UVEditor.updateSelectionOutline();
			this.updateTextureCanvas();
		},
		updateTextureCanvas() {
			if (!this.texture) return;
			this.texture.canvas.style.objectPosition = `0 ${-this.texture.currentFrame * this.inner_height}px`;
			this.texture.canvas.style.objectFit = this.texture.frameCount > 1 ? 'cover' : 'fill';
			this.texture.canvas.style.imageRendering = this.texture.width < this.inner_width ? 'inherit' : 'auto';

			UVEditor.updateOverlayCanvas();

			Vue.nextTick(() => {
				let wrapper = this.$refs.texture_canvas_wrapper;
				let overlay_canvas_mode = this.overlay_canvas_mode || this.texture.wrap_mode == 'repeat';
				if (!wrapper || (wrapper.firstChild == this.texture.canvas && !overlay_canvas_mode)) return;
				while (wrapper.firstChild) {
					wrapper.firstChild.remove();
				}
				if (UVEditor.overlay_canvas && overlay_canvas_mode) {
					wrapper.append(UVEditor.overlay_canvas);
				}
				wrapper.append(this.texture.canvas);
			})
		},
		updateMouseCoords(event) {					
			convertTouchEvent(event);
			if (!this.texture && this.mode == "paint") return; // We abort only if this is paint mode, as edit mode uses these coordinates to select faces
			if (PointerTarget.active) return;

			var {x, y} = UVEditor.getBrushCoordinates(event, this.texture);
			this.mouse_coords.active = true;
			this.mouse_coords.x = x;
			this.mouse_coords.y = y;
			let grab = Toolbox.selected.id == 'move_layer_tool' ||
					  (Toolbox.selected.id == 'selection_tool' && settings.move_with_selection_tool.value && this.texture && this.texture.selection.get(this.mouse_coords.x, this.mouse_coords.y) && BarItems.selection_tool_operation_mode.value == 'create');
			this.$refs.frame.style.cursor = grab ? 'move' : '';

			if (this.mouse_coords.line_preview) {
				let angle = this.getLinePreviewAngle();
				angle = (angle + 180) % 90;
				let length = Math.sqrt(Math.pow(this.mouse_coords.x - this.last_brush_position[0], 2) + Math.pow(this.mouse_coords.y - this.last_brush_position[1], 2));

				Blockbench.setStatusBarText(`${trimFloatNumber(length+1, 1)} - ${trimFloatNumber(angle, 1)}°`);
			}
			this.tickOutlineCanvas();
		},
		onScroll() {
			UVEditor.updateUVNavigator();
			this.tickOutlineCanvas();
		},
		onMouseWheel(event) {
			let is_zoom_gesture = event.ctrlKey && !Pressing.ctrl;
			if (is_zoom_gesture || Keybinds.extra.uv_editor_scroll_zoom.keybind.isTriggered(event) && event.deltaY) {
		
				event.stopPropagation()
				event.preventDefault()
		
				let original_margin = this.getFrameMargin();
				let old_zoom = this.zoom;
				let n = (event.deltaY < 0) ? 0.15 : -0.15;
				if (Math.abs(event.deltaY) < 10) n *= 0.25;
				n *= this.zoom * settings.editor_2d_zoom_speed.value/100;

				let zoom = this.zoom + n;
				if (zoom > (1 - Math.abs(n)) && zoom < (1 + Math.abs(n))) zoom = 1;
				UVEditor.setZoom(zoom);
				
				let updateScroll = () => {
					let {viewport} = this.$refs;
					let offset = $(this.$refs.viewport).offset()
					let margin = this.getFrameMargin();
					let offsetX = event.clientX - offset.left - margin[0];
					let offsetY = event.clientY - offset.top - margin[1];
					// Make it a bit easier to scroll into corners
					offsetX = (offsetX - this.width/2 + margin[0]) * 1.1 + this.width/2 - margin[0];
					offsetY = (offsetY - this.height/2 + margin[1]) * 1.1 + this.height/2 - margin[1];
					let zoom_diff = this.zoom - old_zoom;
					
					viewport.scrollLeft += ((viewport.scrollLeft + offsetX) * zoom_diff) / old_zoom + margin[0] - original_margin[0];
					viewport.scrollTop  += ((viewport.scrollTop  + offsetY) * zoom_diff) / old_zoom + margin[1] - original_margin[1];

					let diagonal_offset = Math.sqrt(Math.pow(margin[0] - viewport.scrollLeft, 2) + Math.pow(margin[1] - viewport.scrollTop, 2));
					if (this.zoom == 1 && Panels.uv.isInSidebar() && diagonal_offset/UVEditor.width < 0.12) {
						this.centerView();
					}

					this.updateTextureCanvas();
					UVEditor.updateUVNavigator();
					this.tickOutlineCanvas();
					
					if (this.mode == 'paint') {
						this.mouse_coords.active = false;
					}
				}
				if (n > 0) {
					Vue.nextTick(updateScroll);
				} else {
					updateScroll();
				}

				return false;
			}
		},
		onTouchStart(event) {
			setActivePanel('uv');
			this.touches_count = event.touches?.length;
			let scope = this;
			let second_touch;
			let original_zoom = this.zoom;
			let original_margin = this.getFrameMargin();
			let offset = $(this.$refs.viewport).offset();
			UVEditor.total_zoom_offset = [6, 6];
			let force = event.touches?.[0]?.force;
			// TODO: Figure out how to exclude stylus but include touch event with force value from touch navigation. Currently uses web app flag to enable navigation for phones
			if (event.touches && (!force || force == 0.5 || !isApp) && !Toolbox.selected.paintTool && (event.target.id == 'uv_frame' || event.target.id == 'uv_background')) {
				// Drag (touch only)
				if (event.touches) {
					event.clientX = event.touches[0].clientX;
					event.clientY = event.touches[0].clientY;
				}
				let {viewport} = this.$refs;
				let margin = this.getFrameMargin();
				let margin_center = [this.width/2, this.height/2];
				let original = [
					viewport.scrollLeft - 5,
					viewport.scrollTop - 5
				];
				function touchPan(e2) {
					if (e2.touches) {
						e2.clientX = e2.touches[0].clientX;
						e2.clientY = e2.touches[0].clientY;

						if (!second_touch && e2.touches[1]) {
							second_touch = e2.touches[1];
						}
						if (second_touch && e2.touches[1]) {

							let factor = Math.sqrt(Math.pow(e2.touches[0].clientX - e2.touches[1].clientX, 2) + Math.pow(e2.touches[0].clientY - e2.touches[1].clientY, 2))
									/ Math.sqrt(Math.pow(event.touches[0].clientX - second_touch.clientX, 2) + Math.pow(event.touches[0].clientY - second_touch.clientY, 2));

							if (!Math.epsilon(scope.zoom, original_zoom * factor, 0.01)) {
								UVEditor.setZoom(original_zoom * factor);

								let margin = scope.getFrameMargin();
								let offsetX = e2.clientX - offset.left - margin[0];
								let offsetY = e2.clientY - offset.top - margin[1];
								let zoom_diff = scope.zoom - original_zoom;

								UVEditor.total_zoom_offset[0] = ((original[0] + event.clientX - e2.clientX + offsetX) * zoom_diff) / original_zoom + margin[0] - original_margin[0];
								UVEditor.total_zoom_offset[1] = ((original[1] + event.clientY - e2.clientY  + offsetY) * zoom_diff) / original_zoom + margin[1] - original_margin[1];
							}
						}
					}
					viewport.scrollLeft = Math.snapToValues(original[0] + event.clientX - e2.clientX + UVEditor.total_zoom_offset[0], [margin[0], margin_center[0]], 10);
					viewport.scrollTop = Math.snapToValues(original[1] + event.clientY - e2.clientY + UVEditor.total_zoom_offset[1], [margin[1], margin_center[1]], 10);

					UVEditor.vue.centered_view = (viewport.scrollLeft == margin[0] || viewport.scrollLeft == margin_center[0])
												&& (viewport.scrollTop == margin[1] || viewport.scrollTop == margin_center[1]);
					UVEditor.updateUVNavigator();
					UVEditor.vue.tickOutlineCanvas();
				}
				function touchPanStop(e) {
					document.removeEventListener('touchmove', touchPan);
					document.removeEventListener('touchend', touchPanStop);
					if (e.which == 3 && Math.pow(viewport.scrollLeft - original[0], 2) + Math.pow(viewport.scrollTop - original[1], 2) > 50) {
						preventContextMenu();
					}
				}
				document.addEventListener('touchmove', touchPan);
				document.addEventListener('touchend', touchPanStop);
				event.preventDefault();
				$(getFocusedTextInput()).trigger('blur');
				return false;
			}
		},
		onTouchEnd(event) {
			this.touches_count = event.touches.length;
		},
		onPointerDown(event) {
			if (this.touches_count) return;

			setActivePanel('uv');
			if (Menu.open) Menu.open.hide();
			if (ReferenceImageMode.active) ReferenceImageMode.deactivate();

			UVEditor.total_zoom_offset = [6, 6];
			if (event.which === 2 ||
				(Keybinds.extra.preview_drag.keybind.isTriggered(event) && event.which != 1)
			) {
				// Drag (Mouse and pen only)
				let {viewport} = this.$refs;
				let margin = this.getFrameMargin();
				let margin_center = [this.width/2, this.height/2];
				let original = [
					viewport.scrollLeft - 5,
					viewport.scrollTop - 5
				];
				function dragMouseWheel(e2) {
					viewport.scrollLeft = Math.snapToValues(original[0] + event.clientX - e2.clientX + UVEditor.total_zoom_offset[0], [margin[0], margin_center[0]], 10);
					viewport.scrollTop = Math.snapToValues(original[1] + event.clientY - e2.clientY + UVEditor.total_zoom_offset[1], [margin[1], margin_center[1]], 10);

					UVEditor.vue.centered_view = (viewport.scrollLeft == margin[0] || viewport.scrollLeft == margin_center[0])
												&& (viewport.scrollTop == margin[1] || viewport.scrollTop == margin_center[1]);
					UVEditor.updateUVNavigator();
					UVEditor.vue.tickOutlineCanvas();
				}
				function dragMouseWheelStop(e) {
					removeEventListeners(document, 'pointermove', dragMouseWheel);
					removeEventListeners(document, 'pointerup', dragMouseWheelStop);
					if (e.which == 3 && Math.pow(viewport.scrollLeft - original[0], 2) + Math.pow(viewport.scrollTop - original[1], 2) > 50) {
						preventContextMenu();
					}
				}
				addEventListeners(document, 'pointermove', dragMouseWheel);
				addEventListeners(document, 'pointerup', dragMouseWheelStop);
				event.preventDefault();
				$(getFocusedTextInput()).trigger('blur');
				return false;

			} else if (
				this.mode == 'paint' &&
				Toolbox.selected.paintTool &&
				(
					event.which === 1 ||
					event.pointerType === 'pen' ||
					event.pointerType === 'touch' ||
					Keybinds.extra.paint_secondary_color.keybind.isTriggered(event)
				)
			) {
				let is_scrollbar_click = event.target.id == 'uv_viewport' && (event.offsetX > event.target.clientWidth || event.offsetY > event.target.heightWidth);
				if (!is_scrollbar_click) {
					// Paint
					UVEditor.startPaintTool(event);
				}
				event.preventDefault();
				return false;

			} else if (
				this.mode == 'uv' &&
				(event.target.id == 'uv_frame' || (!UVEditor.isUVClamped() && event.target.id == 'uv_viewport')) &&
				(
					(event.which === 1 && event.pointerType !== 'touch') ||
					event.pointerType === 'pen'
				)
			) {

				if (event.altKey || Pressing.overrides.alt) {
					return this.dragFace(null, null, event);
				}

				let {selection_rect} = this;
				let scope = this;
				let old_faces = {};
				for (let element of UVEditor.getMappableElements()) {
					old_faces[element.uuid] = UVEditor.getSelectedFaces().slice();
				}
				let old_selected_vertices = {};
				Mesh.selected.forEach(mesh => {
					old_selected_vertices[mesh.uuid] = mesh.getSelectedVertices().slice();
				})


				let old_elements;
				let is_box_uv = UVEditor.isBoxUV();
				if (is_box_uv) {
					old_elements = UVEditor.getMappableElements().slice();
				}
				let frame_offset = scope.$refs.frame.getBoundingClientRect();
				let offsetX = event.clientX - frame_offset.left;
				let offsetY = event.clientY - frame_offset.top;

				function drag(e1) {
					if (scope.touches_count == 2) {
						stop(e1);
						return;
					}
					selection_rect.active = true;
					let rect = getRectangle(
						offsetX / scope.inner_width * scope.uv_resolution[0],
						offsetY / scope.inner_height * scope.uv_resolution[1],
						(offsetX - event.clientX + e1.clientX) / scope.inner_width * scope.uv_resolution[0],
						(offsetY - event.clientY + e1.clientY) / scope.inner_height * scope.uv_resolution[1],
					)
					selection_rect.pos_x = rect.ax;
					selection_rect.pos_y = rect.ay;
					selection_rect.width = rect.x;
					selection_rect.height = rect.y;
					
					let elements;
					if (is_box_uv) {
						elements = Cube.all.filter(cube => !cube.locked);
						elements.safePush(...UVEditor.getMappableElements());
					} else {
						elements = UVEditor.getMappableElements();
					}
					if (UVEditor.vue.display_uv == 'all_elements') {
						elements = Outliner.elements.filter(el => el.faces && !el.locked);
					}
					if (!e1.shiftKey && !Mesh.selected.length) {
						for (let element of elements) {
							UVEditor.getSelectedFaces(element, true).empty();
						}
						if (old_elements) Outliner.selected.empty();
					} else {
						for (let element of elements) {
							if (!old_faces[element.uuid]) continue;
							UVEditor.getSelectedFaces(element, true).replace(old_faces[element.uuid]);
						}
						if (old_elements) Outliner.selected.replace(old_elements);
					}

					
					elements.forEach(element => {
						let select = false;
						if (element.getTypeBehavior('cube_faces') && !element.box_uv) {
							for (let fkey in element.faces) {
								let face = element.faces[fkey];
								if (UVEditor.texture && face.getTexture() != UVEditor.texture) continue;
								let face_rect = getRectangle(...face.uv);
								if (doRectanglesOverlap(rect, face_rect)) {
									UVEditor.getSelectedFaces(element, true).safePush(fkey);
									select = true;
								}
							}
						} else if (element.getTypeBehavior('cube_faces')) {
							let overlaps = false;
							for (let fkey in element.faces) {
								let face = element.faces[fkey];
								if (UVEditor.texture && face.getTexture() != UVEditor.texture) continue;
								let face_rect = getRectangle(...face.uv);
								if (doRectanglesOverlap(rect, face_rect)) {
									overlaps = true;
									break;
								}
							}
							if (overlaps) {
								Outliner.selected.safePush(element);
								select = true;
							}
						} else if (element instanceof Mesh) {
							let selected_vertices = element.getSelectedVertices(true);
							let selected_faces = element.getSelectedFaces(true);
							if (!e1.shiftKey) {
								selected_vertices.empty();
							} else {
								selected_vertices.replace(old_selected_vertices[element.uuid]);
							}
							for (let fkey in element.faces) {
								let face = element.faces[fkey];
								if (UVEditor.texture && face.getTexture() != UVEditor.texture) continue;
								let vertices = face.getSortedVertices();
								if (vertices.length >= 3) {
									let i = 0;
									for (let vkey of vertices) {
										i++;
										let vkey2 = vertices[i] || vertices[0];
										if (lineIntersectsReactangle(face.uv[vkey], face.uv[vkey2], [rect.ax, rect.ay], [rect.bx, rect.by])) {
											selected_faces.safePush(fkey);
											select = true;
										}
										if (pointInRectangle(face.uv[vkey], [rect.ax, rect.ay], [rect.bx, rect.by])) {
											selected_vertices.safePush(vkey);
										}
									}
								}
							}
						}
						if (select && !element.selected) {
							element.markAsSelected();
						}
					})
					updateSelection();
					UVEditor.vue.tickOutlineCanvas();
				}
				function stop(e2) {
					removeEventListeners(document, 'pointermove', drag);
					removeEventListeners(document, 'pointerup', stop);

					if (Math.pow(event.clientX - e2.clientX, 2) + Math.pow(event.clientY - e2.clientY, 2) < 10) {
						/*for (let element of Outliner.elements) {
							UVEditor.getSelectedFaces(element, true).empty();
						}
						if (old_elements) Outliner.selected.empty();
						UVEditor.vue.$forceUpdate();*/
					}
					setTimeout(() => {
						selection_rect.active = false;
					}, 1)
				}
				addEventListeners(document, 'pointermove', drag, false);
				addEventListeners(document, 'pointerup', stop, false);
			}
		},
		onMouseEnter(event) {
			if (this.mode == 'paint' && Painter.current.x != undefined) {
				this.mouse_coords.line_preview = event.shiftKey;
			}
		},
		onMouseLeave(event) {
			if (PointerTarget.active == PointerTarget.types.global_drag_slider) return;
			if (this.mode == 'paint') {
				this.mouse_coords.active = false;
			}
			if (this.mouse_coords.line_preview) {
				Blockbench.setStatusBarText();
				this.mouse_coords.line_preview = false;
			}
		},
		contextMenu(event) {
			setActivePanel('uv');
			if (Blockbench.hasFlag('no_context_menu')) return;
			if (Format.image_editor) {
				UVEditor.menu_image_editor.open(event);
			} else {
				UVEditor.menu.open(event);
			}
		},
		selectTextureMenu(event) {
			let menu = new Menu(Texture.all.map(tex => {
				return {
					name: tex.name,
					icon: tex.img,
					marked: tex == UVEditor.texture,
					click(event) {
						tex.select(event);
					}
				}
			}))
			menu.open(event.target);
		},
		selectFace(element, key, event, keep_selection, support_dragging) {
			let selected_faces = UVEditor.getSelectedFaces(element, true);
			let synced_faces = false;
			if (!element) {
				// If the selection is identical on all elements, we can modify the existing selection
				let elements = UVEditor.getMappableElements();
				let _selected_faces = UVEditor.getSelectedFaces(elements[0], true);
				if (elements.length == 1 || elements.allAre(e2 => _selected_faces.equals(UVEditor.getSelectedFaces(e2)))) {
					selected_faces = _selected_faces;
					synced_faces = true;
				}
			}
			let add_to_list = event.shiftKey || event.ctrlOrCmd || Pressing.overrides.shift || Pressing.overrides.ctrl;
			if (keep_selection && selected_faces.includes(key)) {

			} else if (add_to_list) {
				if (selected_faces.includes(key)) {
					selected_faces.remove(key);
				} else {
					selected_faces.push(key);
				}
			} else {
				selected_faces.replace([key]);
			}
			if (!element && key) {
				UVEditor.getMappableElements().forEach(element => {
					let element_selected_faces = UVEditor.getSelectedFaces(element, true);
					if (synced_faces) {
						element_selected_faces.replace(selected_faces);
					} else if (add_to_list) {
						if (element.faces[key]) {
							element_selected_faces.safePush(key);
						}
					} else {
						if (!element.faces[key]) {
							element_selected_faces.empty();
						} else {
							element_selected_faces.replace([key]);
						}
					}
				})
			}
			UVEditor.vue.updateTexture();
			UVEditor.updateFaceSelection();
			UVEditor.vue.tickOutlineCanvas();

			if (support_dragging) {
				dragHelper(event, {
					start_distance: 10,
					onMove(arg) {
						let e1 = arg.event;
						if (!e1.target || e1.target.nodeName != 'LI' || e1.target.parentElement.id != 'uv_cube_face_bar') return;
						let fkey = e1.target.attributes.face?.value;
						if (!fkey) return;
						for (let element of UVEditor.getMappableElements()) {
							if (element.faces[fkey]) {
								let selected_faces = UVEditor.getSelectedFaces(element, true);
								selected_faces.safePush(fkey);
								UVEditor.updateFaceSelection();
							}
						}
						UVEditor.displayTools();
						UVEditor.updateFaceSelection();
					}
				})
			}
		},
		selectCube(cube, event) {
			if (!this.dragging_uv) {
				cube.select(event);
			}
			UVEditor.vue.updateTexture()
		},
		reverseSelect(event) {
			if (this.mode !== 'uv') return;
			var offset = $(this.$refs.frame).offset();
			let local_position = [
				event.clientX - offset.left,
				event.clientY - offset.top
			];
			if (!this.dragging_uv && !this.selection_rect.active && event.target.id == 'uv_frame') {
				let results = UVEditor.reverseSelect(event, local_position)
				if (!(results && results.length)) {
					// Clear selection if clicking the background
					if (UVEditor.isFaceUV()) {
						for (let element of UVEditor.getMappableElements()) {
							UVEditor.getSelectedFaces(element, true).empty();
						}
					}
					UVEditor.vue.$forceUpdate();
					UVEditor.vue.tickOutlineCanvas();
				}
			}
		},
		drag({event, onStart, onDrag, onEnd, onAbort, snap, uv_grid}) {
			if (event.which == 2 || event.which == 3) return;
			convertTouchEvent(event);
			let scope = this;

			let pos = [0, 0];
			let last_pos = [0, 0];
			let viewport = this.$refs.viewport;
			let initial_scroll_offset = [viewport.scrollLeft, viewport.scrollTop];
			let original_snap = snap;
			let on_start_ran = false;
			function drag(e1) {
				convertTouchEvent(e1);
				let step_x, step_y;
				let snap = original_snap;

				if (uv_grid == false) {
					step_x = (scope.inner_width / scope.texture.width / snap);
					step_y = (scope.inner_height / scope.texture.height / snap);

				} else if (snap == undefined) {
					snap = UVEditor.grid / canvasGridSize(e1.shiftKey || Pressing.overrides.shift, e1.ctrlOrCmd || Pressing.overrides.ctrl);
	
					step_x = (scope.inner_width / UVEditor.getResolution(0) / snap);
					step_y = (scope.inner_height / UVEditor.getResolution(1) / snap);

				} else {	
					step_x = (scope.inner_width / UVEditor.getResolution(0) / snap);
					step_y = (scope.inner_height / UVEditor.getResolution(1) / snap);
				}
				pos[0] = Math.round((e1.clientX - event.clientX + viewport.scrollLeft - initial_scroll_offset[0]) / step_x) / snap;
				pos[1] = Math.round((e1.clientY - event.clientY + viewport.scrollTop  - initial_scroll_offset[1]) / step_y) / snap;

				if (pos[0] != last_pos[0] || pos[1] != last_pos[1]) {
					if (onStart && !on_start_ran) {
						on_start_ran = true;
						onStart();
					}
					let applied_difference = onDrag(pos[0] - last_pos[0], pos[1] - last_pos[1], e1)
					last_pos[0] += applied_difference[0];
					last_pos[1] += applied_difference[1];
					UVEditor.loadData();
					UVEditor.vue.$forceUpdate();
					Canvas.updateView({elements, element_aspects: {uv: true}});
					scope.dragging_uv = true;
				}
			}

			function stop() {
				removeEventListeners(document, 'mousemove touchmove', drag);
				removeEventListeners(document, 'mouseup touchend', stop);
				if (scope.dragging_uv) {
					onEnd();
					setTimeout(() => scope.dragging_uv = false, 10);
				} else {
					if (onAbort) onAbort();
					Undo.cancelEdit();
				}
			}
			addEventListeners(document, 'mousemove touchmove', drag);
			addEventListeners(document, 'mouseup touchend', stop);
		},
		dragFace(element, face_key, event) {
			if (event.which == 2 || event.which == 3) return;

			if (element && !element.selected) {
				element.select(event);
				UVEditor.getSelectedFaces(element, true).empty();
			}

			let faces_selected_before = UVEditor.getSelectedFaces(element).slice();
			if (element && face_key) this.selectFace(element, face_key, event, true);
			let elements = UVEditor.getMappableElements();
			Undo.initEdit({
				elements,
				uv_only: true,
			});
			let total_diff = [0, 0];
			let do_move_uv = !!(BarItems.move_texture_with_uv.value && this.texture);

			UVEditor.getMappableElements().forEach(el => {
				if (el instanceof Mesh) {
					let vertices = el.getSelectedVertices(true);
					if (vertices.length) vertices.empty();
					let edges = el.getSelectedEdges(true);
					if (edges.length) edges.empty();
				}
			})

			let overlay_canvas;
			let started = false;

			this.drag({
				event,
				snap: UVEditor.isBoxUV() ? 1 : undefined,
				onDrag: (diff_x, diff_y) => {
					if (!started) {
						started = true;
						if (do_move_uv) {
							Undo.initEdit({
								elements,
								uv_only: true,
								bitmap: true,
								textures: [this.texture]
							});
	
							overlay_canvas = Interface.createElement('canvas', {class: 'move_texture_with_uv'});
							let ctx = overlay_canvas.getContext('2d');
							overlay_canvas.width = this.texture.width;
							overlay_canvas.height = this.texture.height;
							
							this.texture.edit(canvas => {
								let tex_ctx = canvas.getContext('2d');
								ctx.beginPath();
								tex_ctx.save();
								tex_ctx.beginPath();
								UVEditor.getMappableElements().forEach(el => {
									if (el instanceof Mesh) {
										for (var fkey in el.faces) {
											var face = el.faces[fkey];
											if (!UVEditor.getSelectedFaces(el).includes(fkey)) continue;
											if (face.vertices.length <= 2 || face.getTexture() !== this.texture) continue;
											
											let matrix = face.getOccupationMatrix(true, [0, 0]);
											for (let x in matrix) {
												for (let y in matrix[x]) {
													if (!matrix[x][y]) continue;
													x = parseInt(x); y = parseInt(y);
													ctx.rect(x, y, 1, 1);
													tex_ctx.rect(x, y, 1, 1);
												}
											}
										}
									} else {
										let factor_x = this.texture.width  / UVEditor.getUVWidth();
										let factor_y = this.texture.height / UVEditor.getUVHeight();
										for (var fkey in el.faces) {
											var face = el.faces[fkey];
											if (!UVEditor.getSelectedFaces(el).includes(fkey) && !el.box_uv) continue;
											if (face.getTexture() !== this.texture) continue;
											
											let rect = face.getBoundingRect();
											let canvasRect = [
												Math.floor(rect.ax * factor_x),
												Math.floor(rect.ay * factor_y),
												Math.ceil(rect.bx * factor_x) - Math.floor(rect.ax * factor_x),
												Math.ceil(rect.by * factor_y) - Math.floor(rect.ay * factor_y),
											]
											ctx.rect(...canvasRect);
											tex_ctx.rect(...canvasRect);
										}
									}
								})
								ctx.clip();
								ctx.drawImage(this.texture.canvas, 0, 0);
								tex_ctx.clip();
								tex_ctx.clearRect(0, 0, canvas.width, canvas.height);
								tex_ctx.restore();
							}, {no_undo: true})
	
							UVEditor.vue.$refs.frame.append(overlay_canvas);
	
						} else {
							Undo.initEdit({elements, uv_only: true});
						}
					}
					elements.forEach(element => {
						if (element instanceof Mesh) {
							UVEditor.getSelectedFaces(element).forEach(key => {
								let face = element.faces[key];
								if (!face) return;
								if (UVEditor.isUVClamped()) {
									face.vertices.forEach(vertex_key => {
										diff_x = Math.clamp(diff_x, -face.uv[vertex_key][0], UVEditor.getUVWidth()  - face.uv[vertex_key][0]);
										diff_y = Math.clamp(diff_y, -face.uv[vertex_key][1], UVEditor.getUVHeight() - face.uv[vertex_key][1]);
									})
								}
							})
						} else if (element.box_uv) {
							let size = element.size(undefined, Format.box_uv_float_size != true);
							let uv_size = [
								size[2] + size[0] + (size[1] ? size[2] : 0) + size[0],
								size[2] + size[1],
							]
							if (UVEditor.isUVClamped()) {
								diff_x = Math.clamp(diff_x, -element.uv_offset[0] - (size[1] ? 0 : size[2]), UVEditor.getUVWidth()  - element.uv_offset[0] - uv_size[0]);
								diff_y = Math.clamp(diff_y, -element.uv_offset[1] - (size[0] ? 0 : size[2]), UVEditor.getUVHeight() - element.uv_offset[1] - uv_size[1]);
							}

						} else {
							if (UVEditor.isUVClamped()) {
								UVEditor.getSelectedFaces(element).forEach(key => {
									if (element.faces[key] && element.getTypeBehavior('cube_faces') && element.faces[key].texture !== null) {
										diff_x = Math.clamp(diff_x, -element.faces[key].uv[0], UVEditor.getUVWidth()  - element.faces[key].uv[0]);
										diff_y = Math.clamp(diff_y, -element.faces[key].uv[1], UVEditor.getUVHeight() - element.faces[key].uv[1]);
										diff_x = Math.clamp(diff_x, -element.faces[key].uv[2], UVEditor.getUVWidth()  - element.faces[key].uv[2]);
										diff_y = Math.clamp(diff_y, -element.faces[key].uv[3], UVEditor.getUVHeight() - element.faces[key].uv[3]);
									}
								})
							}
						}
					})
					elements.forEach(element => {
						if (element instanceof Mesh) {
							UVEditor.getSelectedFaces(element).forEach(key => {
								let face = element.faces[key];
								if (!face) return;
								face.vertices.forEach(vertex_key => {
									face.uv[vertex_key][0] += diff_x;
									face.uv[vertex_key][1] += diff_y;
								})
							})
						} else if (element.box_uv) {
							element.uv_offset[0] = Math.floor(element.uv_offset[0] + diff_x);
							element.uv_offset[1] = Math.floor(element.uv_offset[1] + diff_y);
						} else {
							UVEditor.getSelectedFaces(element).forEach(key => {
								let face = element.faces[key]
								if (face instanceof CubeFace && element.faces[key].texture !== null) {
									face.uv[0] += diff_x;
									face.uv[1] += diff_y;
									face.uv[2] += diff_x;
									face.uv[3] += diff_y;
								}
							})
						}
					})
					if (do_move_uv) {
						total_diff[0] += diff_x;
						total_diff[1] += diff_y;
						overlay_canvas.style.left = this.toPixels(total_diff[0]);
						overlay_canvas.style.top  = this.toPixels(total_diff[1]);
					}
					return [diff_x, diff_y]
				},
				onEnd: () => {
					UVEditor.disableAutoUV()
					if (do_move_uv) {
						this.texture.edit((canvas) => {
							canvas.getContext('2d').drawImage(
								overlay_canvas,
								total_diff[0] * this.texture.width  / UVEditor.getUVWidth(),
								total_diff[1] * this.texture.height / UVEditor.getUVHeight()
							);
						}, {no_undo: true})
						overlay_canvas.remove();
						Canvas.updateView({elements, element_aspects: {uv: true}});
					}
					Undo.finishEdit('Move UV');
				},
				onAbort: () => {
					if (do_move_uv) {
						if (overlay_canvas) overlay_canvas.remove();
					}
					// Select UV island
					if (face_key && Mesh.selected[0]) {
						let selected_faces = UVEditor.getSelectedFaces(element, true);
						let selected_before = selected_faces.slice();
						UVEditor.selectMeshUVIsland(face_key);
						if (
							(selected_faces.includes(faces_selected_before[0]) && faces_selected_before[0] !== face_key) ||
							(event.shiftKey || event.ctrlOrCmd || Pressing.overrides.shift || Pressing.overrides.ctrl)
						) {
							selected_faces.replace(selected_before);
						} else {
							return;
						}
					}
					// Unselect previously selected face when ctrl+clicking
					if (face_key && (event.ctrlOrCmd || Pressing.overrides.ctrl) && faces_selected_before.includes(face_key)) {
						let selected_faces = UVEditor.getSelectedFaces(element, true);
						selected_faces.remove(face_key);
						UVEditor.vue.$forceUpdate();
					}
				}
			})
		},
		resizeFace(face_key, event, x_side, y_side) {
			if (event.which == 2 || event.which == 3) return;
			event.stopPropagation();
			let elements = UVEditor.getMappableElements();
			Undo.initEdit({elements, uv_only: true})
			let inverted = {};
			elements.forEach(element => {
				let faces = inverted[element.uuid] = {};
				UVEditor.getSelectedFaces(element).forEach(key => {
					if (element.faces[key] && element.getTypeBehavior('cube_faces')) {
						faces[key] = [
							element.faces[key].uv[0] > element.faces[key].uv[2],
							element.faces[key].uv[1] > element.faces[key].uv[3],
						]
					}
				})
			})

			this.drag({
				event,
				onDrag: (x, y) => {
					const clampUvIfEnabled = UVEditor.isUVClamped()
						? (value, upper_bound) => Math.clamp(value, 0, upper_bound)
						: (value, _upper_bound) => value;
					elements.forEach(element => {
						UVEditor.getSelectedFaces(element).forEach(key => {
							if (element.faces[key] && element.getTypeBehavior('cube_faces')) {
								if (x_side && (x_side == -1) != inverted[element.uuid][key][0]) element.faces[key].uv[0] = clampUvIfEnabled(element.faces[key].uv[0] + x, UVEditor.getUVWidth());
								if (y_side && (y_side == -1) != inverted[element.uuid][key][1]) element.faces[key].uv[1] = clampUvIfEnabled(element.faces[key].uv[1] + y, UVEditor.getUVHeight());
								if (x_side && (x_side ==  1) != inverted[element.uuid][key][0]) element.faces[key].uv[2] = clampUvIfEnabled(element.faces[key].uv[2] + x, UVEditor.getUVWidth());
								if (y_side && (y_side ==  1) != inverted[element.uuid][key][1]) element.faces[key].uv[3] = clampUvIfEnabled(element.faces[key].uv[3] + y, UVEditor.getUVHeight());
							}
						})
					})
					return [x, y]
				},
				onEnd: () => {
					UVEditor.disableAutoUV()
					Undo.finishEdit('Resize UV')
				}
			})
		},
		rotateFace(event) {
			const clampUvIfEnabled = UVEditor.isUVClamped()
				? (value, upper_bound) => Math.clamp(value, 0, upper_bound)
				: (value, _upper_bound) => value;
			if (event.which == 2 || event.which == 3) return;
			event.stopPropagation();
			convertTouchEvent(event);
			let scope = this;
			let elements = UVEditor.getMappableElements();
			let do_move_texture = !!(BarItems.move_texture_with_uv.value && this.texture);
			let texturesModified = new Set();
			let originalFaceData = {};

			Undo.initEdit({
				elements,
				uv_only: true,
				bitmap: do_move_texture,
				textures: do_move_texture ? [this.texture] : undefined
			})

			let face_center = [0, 0];
			let points = 0;
			elements.forEach(element => {
				UVEditor.getSelectedFaces(element).forEach(fkey => {
					let face = element.faces[fkey];
					if (!face) return;
					if (face instanceof CubeFace) {
						face_center[0] += face.uv[0] + face.uv[2];
						face_center[1] += face.uv[1] + face.uv[3];
						points += 2;
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
								originalFaceData[element.uuid + ':' + fkey] = {
									texture,
									x, y, w, h,
									pixels: texture.ctx.getImageData(x, y, w, h)
								};
							}
						}
					} else if (element instanceof Mesh) {
						face.old_uv = {};
						face.vertices.forEach(vkey => {
							if (!face.uv[vkey]) return;
							face_center[0] += face.uv[vkey][0];
							face_center[1] += face.uv[vkey][1];
							points += 1;
							face.old_uv[vkey] = face.uv[vkey].slice();
						})
					}
				})
			})
			face_center.forEach((v, i) => face_center[i] = v / points);

			let offset = $(UVEditor.vue.$refs.frame).offset();
			let center_on_screen = [
				face_center[0] * UVEditor.getUVPixelSize() + offset.left,
				face_center[1] * UVEditor.getUVPixelSize() + offset.top,
			]

			let angle = 0;
			let last_angle;
			let original_angle;
			let straight_angle;
			let cumulative_rotation = 0;
			let snap = elements[0] instanceof Cube ? 90 : 1;
			function drag(e1) {
				convertTouchEvent(e1);

				angle = Math.atan2(
					(e1.clientY - center_on_screen[1]),
					(e1.clientX - center_on_screen[0]),
				)
				angle = Math.round(Math.radToDeg(angle) / snap) * snap;
				if (original_angle == undefined) original_angle = angle;
				angle -= original_angle;
				if (last_angle == undefined) last_angle = angle;
				if (Math.abs(angle - last_angle) > 300) last_angle = angle;

				if (angle != last_angle && (straight_angle == undefined || Math.abs(straight_angle - angle) > 6 || e1.ctrlOrCmd || Pressing.overrides.ctrl)) {

					straight_angle = undefined;
					scope.helper_lines.x = scope.helper_lines.y = -1;
					let rotation_step = 90 * Math.sign(last_angle - angle);
					cumulative_rotation = (cumulative_rotation + rotation_step + 360) % 360;

					elements.forEach(element => {
						if (element.getTypeBehavior('cube_faces') && Format.uv_rotation) {
							UVEditor.getSelectedFaces(element).forEach(key => {
								if (element.faces[key]) {
									element.faces[key].rotation += rotation_step;
									if (element.faces[key].rotation == 360) element.faces[key].rotation = 0;
									if (element.faces[key].rotation < 0) element.faces[key].rotation += 360;

									if (do_move_texture) {
										let dataKey = element.uuid + ':' + key;
										let data = originalFaceData[dataKey];
										if (data && data.pixels) {
											let rotated = rotateImageDataByDegrees(data.pixels, cumulative_rotation);
											let clearSize = Math.max(data.w, data.h);
											data.texture.ctx.clearRect(data.x, data.y, clearSize, clearSize);
											data.texture.ctx.putImageData(rotated, data.x, data.y);
											texturesModified.add(data.texture);
										}
									}
								}
							})

						} else if (element instanceof Mesh) {
							function setUV(angle) {
								UVEditor.getSelectedFaces(element).forEach(fkey => {
									let face = element.faces[fkey];
									if (!face) return;
									let sin = Math.sin(Math.degToRad(angle));
									let cos = Math.cos(Math.degToRad(angle));
									face.vertices.forEach(vkey => {
										if (!face.uv[vkey]) return;
										face.uv[vkey][0] = face.old_uv[vkey][0] - face_center[0];
										face.uv[vkey][1] = face.old_uv[vkey][1] - face_center[1];
										let a = (face.uv[vkey][0] * cos - face.uv[vkey][1] * sin);
										let b = (face.uv[vkey][0] * sin + face.uv[vkey][1] * cos);
										face.uv[vkey][0] = clampUvIfEnabled(a + face_center[0], UVEditor.getUVWidth());
										face.uv[vkey][1] = clampUvIfEnabled(b + face_center[1], UVEditor.getUVHeight());
									})
								})
							}
							setUV(angle);
							let e = 0.6;
							UVEditor.getSelectedFaces(element).forEach(fkey => {
								let face = element.faces[fkey];
								if (!face) return;
								face.vertices.forEach((vkey, i) => {
									for (let j = i+1; j < face.vertices.length; j++) {
										let relative_angle = Math.radToDeg(Math.PI + Math.atan2(
											face.uv[vkey][1] - face.uv[face.vertices[j]][1],
											face.uv[vkey][0] - face.uv[face.vertices[j]][0],
										)) % 180;
										if (Math.abs(relative_angle - 90) < e) {
											straight_angle = angle - (relative_angle - 90);
											if (scope.helper_lines.x == -1) scope.helper_lines.x = face.uv[vkey][0];
											break;
										}
										if (relative_angle < e || 180 - relative_angle < e) {
											straight_angle = angle - (relative_angle > 90 ? (relative_angle-180) : relative_angle);
											if (scope.helper_lines.y == -1) scope.helper_lines.y = face.uv[vkey][1];
											break;
										}
									}
								})
							})
							if (straight_angle) {
								setUV(straight_angle);
							}
						}
					})
					UVEditor.turnMapping()

					// Update texture display during drag
					if (do_move_texture) {
						for (let texture of texturesModified) {
							texture.updateSource(texture.canvas.toDataURL());
						}
					}

					last_angle = angle;
					UVEditor.loadData();
					UVEditor.vue.$forceUpdate();
					Canvas.updateView({elements, element_aspects: {uv: true}});
					scope.dragging_uv = true;
				}
			}

			function stop() {
				removeEventListeners(document, 'mousemove touchmove', drag);
				removeEventListeners(document, 'mouseup touchend', stop);
				scope.helper_lines.x = scope.helper_lines.y = -1;
				if (scope.dragging_uv) {
					if (do_move_texture) {
						for (let texture of texturesModified) {
							texture.updateChangesAfterEdit();
						}
					}
					UVEditor.disableAutoUV()
					Undo.finishEdit('Rotate UV')
					setTimeout(() => scope.dragging_uv = false, 10);
				} else {
					Undo.cancelEdit();
				}
			}
			addEventListeners(document, 'mousemove touchmove', drag);
			addEventListeners(document, 'mouseup touchend', stop);

		},
		scaleFaces(event) {
			if (event.which == 2 || event.which == 3) return;
			event.stopPropagation();
			let elements = UVEditor.getMappableElements();
			Undo.initEdit({elements, uv_only: true})
			elements.forEach(element => {
				UVEditor.getSelectedFaces(element).forEach(fkey => {
					let face = element.faces[fkey];
					if (!face) return;
					if (face instanceof CubeFace) {
						face.old_uv = face.uv.slice();
					} else if (face instanceof MeshFace) {
						face.old_uv = {};
						face.vertices.forEach(vkey => {
							if (!face.uv[vkey]) return;
							face.old_uv[vkey] = face.uv[vkey].slice();
						})
					}
				})
			})
			let min = this.getSelectedUVBoundingBox();
			let bounding_size = [min[2]-min[0], min[3]-min[1]]

			let total_offset = [0, 0];
			let total_offset_y = 0;
			this.drag({
				event,
				onDrag: (x, y, event) => {
					total_offset[0] += x;
					total_offset[1] += y;
					total_offset_y = (event.altKey || Pressing.overrides.alt) ? (total_offset[0] / bounding_size[0] * bounding_size[1]) : total_offset[1];
					elements.forEach(element => {
						UVEditor.getSelectedFaces(element).forEach(key => {
							if (!element.faces[key]) return;
							let face = element.faces[key];
							if (element.getTypeBehavior('cube_faces')) {
								face.uv[0] = min[0] + (face.old_uv[0] - min[0]) * (1 + total_offset[0]/bounding_size[0]);
								face.uv[1] = min[1] + (face.old_uv[1] - min[1]) * (1 + total_offset_y /bounding_size[1]);
								face.uv[2] = min[0] + (face.old_uv[2] - min[0]) * (1 + total_offset[0]/bounding_size[0]);
								face.uv[3] = min[1] + (face.old_uv[3] - min[1]) * (1 + total_offset_y /bounding_size[1]);
							} else if (element instanceof Mesh) {
								for (let vkey in face.uv) {
									face.uv[vkey][0] = min[0] + (face.old_uv[vkey][0] - min[0]) * (1 + total_offset[0]/bounding_size[0]);
									face.uv[vkey][1] = min[1] + (face.old_uv[vkey][1] - min[1]) * (1 + total_offset_y /bounding_size[1]);
								}
							}
						})
					})
					UVEditor.vue.tickOutlineCanvas();
					return [x, y]
				},
				onEnd: () => {
					UVEditor.disableAutoUV()
					Undo.finishEdit('Scale UV')
				}
			})
		},

		dragVertices(element, vertex_key, event) {
			if (event.which == 2 || event.which == 3) return;

			let sel_vertices = element.getSelectedVertices(true);
			let add_to_selection = (event.shiftKey || event.ctrlOrCmd || Pressing.overrides.shift || Pressing.overrides.ctrl);
			if (sel_vertices.includes(vertex_key)) {

			} else if (add_to_selection) {
				if (sel_vertices.includes(vertex_key)) {
					sel_vertices.remove(vertex_key);
				} else {
					sel_vertices.push(vertex_key);
				}
			} else {
				sel_vertices.replace([vertex_key]);
			}
			updateSelection();
			UVEditor.vue.tickOutlineCanvas();

			let elements = UVEditor.getMappableElements();
			Undo.initEdit({elements, uv_only: true})

			this.drag({
				event,
				onDrag: (x, y, event) => {
					if (UVEditor.isUVClamped()) {
						elements.forEach(element => {
							let vertices = element.getSelectedVertices();
							UVEditor.getSelectedFaces(element).forEach(key => {
								let face = element.faces[key];
								if (!face) return;
								face.vertices.forEach(vertex_key => {
									if (vertices.includes(vertex_key)) {
										x = Math.clamp(x, -face.uv[vertex_key][0], UVEditor.getUVWidth() - face.uv[vertex_key][0]);
										y = Math.clamp(y, -face.uv[vertex_key][1], UVEditor.getUVHeight() - face.uv[vertex_key][1]);
									}
								})
							})
						})
					}
					elements.forEach(element => {
						let vertices = element.getSelectedVertices().slice();
						UVEditor.getSelectedFaces(element).forEach(key => {
							let face = element.faces[key];
							if (!face) return;
							let old_uv_coords = face.vertices.map(vkey => face.uv[vkey].slice())
							face.vertices.forEach((vertex_key, i) => {
								if (vertices.includes(vertex_key)) {
									let is_duplicate = face.vertices.find((vkey2, j) => {
										return j > i && face.uv[vertex_key].equals(old_uv_coords[j])
									})
									if (is_duplicate) {
										vertices.remove(vertex_key);
										return;
									}
									face.uv[vertex_key][0] += x;
									face.uv[vertex_key][1] += y;
									if ((event.shiftKey || Pressing.overrides.shift) && !(event.ctrlOrCmd || Pressing.overrides.ctrl)) {
										let multiplier = (settings.shift_size.value / 16) * UVEditor.grid;
										face.uv[vertex_key][0] = Math.round(face.uv[vertex_key][0] * multiplier) / multiplier;
										face.uv[vertex_key][1] = Math.round(face.uv[vertex_key][1] * multiplier) / multiplier;
									}
								}
							})
						})
					})
					return [x, y]
				},
				onEnd: () => {
					Undo.finishEdit('Move UV');
				},
				onAbort() {
					if (!add_to_selection) {
						sel_vertices.replace([vertex_key]);
					}
				}
			})
		},

		toPixelValue(uv_coord, offset = 0) {
			return (uv_coord / this.uv_resolution[0] * this.inner_width + offset);
		},
		toPixels(uv_coord, offset = 0) {
			return this.toPixelValue(uv_coord, offset) + 'px';
		},
		toTexturePixels(tex_coord, axis, offset = 0) {
			if (axis == 1 && this.texture.currentFrame > 0) {
				return ((tex_coord / this.texture.width - this.texture.currentFrame) * this.inner_width + offset) + 'px';
			} else {
				return (tex_coord / this.texture.width * this.inner_width + offset) + 'px';
			}
		},
		getDisplayedUVElements() {
			if (this.mode == 'uv' || this.uv_overlay) {
				return (this.display_uv === 'all_elements' || this.mode == 'paint')
					 ? this.all_mappable_elements
					 : this.mappable_elements;
			} else {
				return [];
			}
		},
		getMeshFaceOutline(face) {
			let coords = [];
			let uv_offset = [
				-this.getMeshFaceCorner(face, 0),
				-this.getMeshFaceCorner(face, 1),
			]
			let uv_factor = this.uv_resolution[0] / this.inner_width;
			face.getSortedVertices().forEach(key => {
				let UV = face.uv[key];
				coords.push(
					Math.roundTo((UV[0] + uv_offset[0]) / uv_factor + 1, 4) + ',' +
					Math.roundTo((UV[1] + uv_offset[1]) / uv_factor + 1, 4)
				)
			})
			return coords.join(' ');
		},
		getMeshFaceCorner(face, axis) {
			let val = Infinity;
			face.vertices.forEach(key => {
				let UV = face.uv[key];
				val = Math.min(val, UV[axis]);
			})
			return val;
		},
		getMeshFaceWidth(face, axis) {
			let min = Infinity;
			let max = 0;
			face.vertices.forEach(key => {
				let UV = face.uv[key];
				min = Math.min(min, UV[axis]);
				max = Math.max(max, UV[axis]);
			})
			return max - min;
		},
		filterMeshFaces(element) {
			let keys = Object.keys(element.faces);
			if (keys.length > 2000) {
				let result = {};
				element.getSelectedFaces().forEach(key => {
					result[key] = element.faces[key];
				})
				return result;
			} else {
				return element.faces;
			}
		},
		isScalingAvailable() {
			let element = this.mappable_elements[0];
			if (element?.getTypeBehavior('cube_faces')) {
				return UVEditor.isFaceUV() && UVEditor.getSelectedFaces(element).some(fkey => element.faces[fkey] && element.faces[fkey].texture !== null);

			} else if (this.mappable_elements[0] instanceof Mesh) {
				return this.mappable_elements[0].getSelectedFaces().length > 0;
			}
		},
		isRotatingAvailable() {
			/*if (this.mappable_elements[0] instanceof Cube) {
				return UVEditor.isFaceUV();
			}*/
			if (this.mappable_elements[0] instanceof Mesh) {
				return this.mappable_elements[0].getSelectedFaces().length > 0;
			}
		},
		getSelectedUVBoundingBox(all_faces) {
			if (!Project) return [0, 0, 0, 0];
			let min = [Infinity, Infinity];
			let max = [-Infinity, -Infinity];
			this.mappable_elements.forEach(element => {
				let faces = UVEditor.getSelectedFaces(element);
				if ((element instanceof Cube && element.box_uv) || (all_faces && !faces.length)) {
					faces = Object.keys(element.faces);
				}
				faces.forEach(fkey => {
					if (element instanceof SplineMesh) return;
					if (element.faces[fkey].texture === null) return;

					let face = element.faces[fkey];
					if (face instanceof CubeFace) {
						min[0] = Math.min(min[0], face.uv[0], face.uv[2]);
						min[1] = Math.min(min[1], face.uv[1], face.uv[3]);
						max[0] = Math.max(max[0], face.uv[0], face.uv[2]);
						max[1] = Math.max(max[1], face.uv[1], face.uv[3]);
					} else if (element instanceof Mesh) {
						face.vertices.forEach(vkey => {
							if (!face.uv[vkey]) return;
							min[0] = Math.min(min[0], face.uv[vkey][0]);
							min[1] = Math.min(min[1], face.uv[vkey][1]);
							max[0] = Math.max(max[0], face.uv[vkey][0]);
							max[1] = Math.max(max[1], face.uv[vkey][1]);
						})
					}
				})
			})
			return [...min, ...max];
		},
		getBrushOutlineStyle() {
			if (Toolbox.selected.brush && Settings.get('brush_cursor_2d')) {
				var pixel_size = this.inner_width / (this.texture ? this.texture.width : Project.texture_width);
				//pos
				let offset = 0;
				if (!Toolbox.selected.brush || Condition(Toolbox.selected.brush.floor_coordinates)) {
					offset = BarItems.slider_brush_size.get()%2 == 0 && Toolbox.selected.brush?.offset_even_radius ? 0 : 0.5;
				}
				let left = this.mouse_coords.x;
				let top =  this.mouse_coords.y - ((this.texture && this.texture.frameCount) ? this.texture.currentFrame * this.texture.display_height : 0);
				left = (left + offset) * pixel_size;
				top =  (top + offset) * pixel_size;
				//size
				let dimensions = Painter.getBrushDimensions();
				return {
					'--width': (dimensions[0]/2) * pixel_size,
					'--height': (dimensions[1]/2) * pixel_size,
					left: left+'px',
					top: top+'px'
				}
			} else {
				return {display: 'none'};
			}
		},
		getCopyBrushOutlineStyle() {
			if (Toolbox.selected.brush) {
				var pixel_size = this.inner_width / (this.texture ? this.texture.width : Project.texture_width);
				//pos
				let offset = this.copy_brush_source.size%2 == 0 && Toolbox.selected.brush?.offset_even_radius ? 0 : 0.5;
				let left = (this.copy_brush_source.x + offset) * pixel_size;
				let top =  (this.copy_brush_source.y + offset) * pixel_size;
				//size
				let dimensions = Painter.getBrushDimensions(this.copy_brush_source.size);
				return {
					'--width': (dimensions[0]/2) * pixel_size,
					'--height': (dimensions[1]/2) * pixel_size,
					left: left+'px',
					top: top+'px'
				}
			} else {
				return {display: 'none'};
			}
		},
		getFrameMargin(style) {
			let gap_x = Math.max((this.width - this.inner_width) / 2, 0);
			let gap_y = Math.max((this.height - this.inner_height) / 2, 0);
			let margin = [
				Math.floor(gap_x + this.width/2),
				Math.floor(gap_y + this.height/2),
			];
			return style ? `${margin[1]}px ${margin[0]}px` : margin;
		},
		getTextureSelectionPolygon() {
			return this.texture_selection_polygon.map((point, i) => {
				let x = point[0] / this.texture.width * this.inner_width;
				let y = point[1] / this.texture.width * this.inner_width;
				return `${i?'L':'M'}${x+1} ${y+1}`;
			}).join(' ');
		},
		isSelectionPolygonClosed() {
			let polygon = this.texture_selection_polygon;
			if (polygon.length <= 3) return false;
			let first = polygon[0];
			let last = polygon.last()
			let distance = Math.sqrt(Math.pow(first[0]-last[0], 2) + Math.pow(first[1]-last[1], 2));
			let radius = Blockbench.isTouch ? 12 : 7;
			return distance < (radius/UVEditor.getPixelSize());
		},

		startTextureSelection(x, y, event) {
			let texture = UVEditor.texture;
			if (!texture) return;
			if (texture.img.naturalWidth + texture.img.naturalHeight == 0) return;
			if (!texture.selected) texture.select();

			let clicked_val = texture.selection.get(Math.floor(x), Math.floor(y));
			let selection_mode = BarItems.selection_tool.mode;
			let op_mode = BarItems.selection_tool_operation_mode.value;
			let selection_rect = this.texture_selection_rect;
			let selection_polygon = this.texture_selection_polygon;
			let scope = this;
			let start_x, start_y, calcrect;
			let layer = texture.getActiveLayer();
			let layers = texture.layers.filter(layer => layer instanceof TextureLayer && layer.selected);
			let move_with_selection_tool = Toolbox.selected.id == 'selection_tool' && op_mode == 'create' && settings.move_with_selection_tool.value && (clicked_val || layer?.in_limbo)
			let create_selection = Toolbox.selected.id == 'selection_tool'
				&& !move_with_selection_tool
				&& !event.target.classList.contains('uv_layer_transform_handles');
			let initial_offsets = new Map();
			layers.forEach(l => initial_offsets.set(l, l.offset.slice()));

			if (!create_selection) {
				x = Math.round(x);
				y = Math.round(y);
			}
			start_x = x;
			start_y = y;

			if (create_selection) {
				Undo.initSelection({texture_selection: true});
				if (op_mode == 'create' && (selection_mode != 'lasso' || selection_polygon.length == 0)) {
					texture.selection.clear();
				}
				
				if (selection_mode == 'wand' || selection_mode == 'color') {
					let {canvas, ctx, offset} = texture.getActiveCanvas();
					let image_data = ctx.getImageData(x - offset[0], y - offset[1], 1, 1);
					let pxcol = [...image_data.data];
					let map = {};
					let color_threshold = BarItems.slider_color_select_threshold.get();
					let pxcol_lab = rgb2lab(pxcol);
					let colorsWithinThreshold = (color_b) => {
						if (pxcol.equals(color_b)) return true;
						if (color_threshold == 0) return false;
						if (Math.abs(pxcol[3] - color_b[3]) / 2.52 > color_threshold) return false;
						let color_b_lab = rgb2lab(color_b);
						let distance = labColorDistance(pxcol_lab, color_b_lab);
						return distance <= color_threshold;
					}
					Painter.scanCanvas(ctx, 0, 0, canvas.width, canvas.height, (x, y, px) => {
						if (colorsWithinThreshold(px)) {
							if (!map[x]) map[x] = {};
							map[x][y] = true
						}
					})
					var scan_value = true;
					if (selection_mode == 'wand') {
						let points = [[x - offset[0], y - offset[1]]];
						for (let i = 0; i < 1_000_000; i++) {
							let current_points = points;
							points = [];
							for (let [x, y] of current_points) {
								if (map[x] && map[x][y]) {
									map[x][y] = false;
									points.push([x+1, y], [x-1, y], [x, y+1], [x, y-1]);
								}
							}
							if (points.length == 0) break;
						}
						scan_value = false;
					}
					let value = op_mode == 'subtract' ? 0 : (op_mode == 'intersect' ? 2 : 1);
					for (let x in map) {
						for (let y in map[x]) {
							if (map[x][y] == scan_value) {
								x = parseInt(x);
								y = parseInt(y);
								if (op_mode == 'intersect') {
									let previous = texture.selection.get(x + offset[0], y + offset[1]);
									if (!previous) continue;
								}
								texture.selection.set(x + offset[0], y + offset[1], value);
							}
						}
					}
					if (op_mode == 'intersect') {
						texture.selection.forEachPixel((x, y, value, i) => {
							if (value == 2) {
								texture.selection.array[i] = 1;
							} else {
								texture.selection.array[i] = 0;
							}
						})
					}
					UVEditor.updateSelectionOutline();
					Undo.finishSelection('Select color');
					return;
				} else if (selection_mode == 'lasso') {
					selection_polygon.push([x, y]);
				}
			}

			let last_x, last_y;
			let started_movement = false;
			function drag(e1) {

				let {x, y} = UVEditor.getBrushCoordinates(e1, texture);
				if (!create_selection) {
					x = Math.round(x);
					y = Math.round(y);
				}
				if (last_x == x && last_y == y) return;
				last_x = x, last_y = y;
				
				if (create_selection && selection_mode == 'lasso') {
					selection_polygon.push([x, y]);

				} else if (create_selection) {
					let start_x_here = start_x;
					let start_y_here = start_y;
					if (!settings.nearest_rectangle_select.value) {
						if (x >= start_x) x++;
						if (y >= start_y) y++;
						if (x < start_x) start_x_here++;
						if (y < start_y) start_y_here++;
					}
					if (x === Painter.current.x && y === Painter.current.y) return;
					Painter.current.x = x = Math.clamp(x, 0, UVEditor.texture.img.naturalWidth);
					Painter.current.y = y = Math.clamp(y, 0, UVEditor.texture.img.naturalHeight);
					start_x_here = Math.clamp(start_x_here, 0, UVEditor.texture.img.naturalWidth);
					start_y_here = Math.clamp(start_y_here, 0, UVEditor.texture.img.naturalHeight);
				
					calcrect = getRectangle(start_x_here, start_y_here, x, y);
					if (!calcrect.x && !calcrect.y) return;
					if (e1.ctrlOrCmd || Pressing.overrides.ctrl) {
						calcrect.y = calcrect.x = Math.round((calcrect.y + calcrect.x) / 2);
						calcrect.bx = calcrect.ax + calcrect.x;
						calcrect.by = calcrect.ay + calcrect.y;
					}

					selection_rect.active = true;
					selection_rect.ellipse = selection_mode == 'ellipse';
					selection_rect.pos_x = calcrect.ax;
					selection_rect.pos_y = calcrect.ay;
					selection_rect.width = calcrect.x;
					selection_rect.height = calcrect.y;

					Blockbench.setCursorTooltip(`${selection_rect.width} x ${selection_rect.height}`);

				} else {
					// Move Layer
					if (!started_movement) {
						UVEditor.vue.selection_outline = '';
						if ((!layer || !layer.in_limbo) && texture.selection.is_custom && texture.selection.hasSelection()) {
							Undo.initEdit({textures: [texture], bitmap: true});
							texture.selectionToLayer(false, (e1.altKey || Pressing.overrides.alt));
							layer = texture.getActiveLayer();
							layers = [layer];
							initial_offsets.set(layer, layer.offset.slice());
						} else if (!layer) {
							Undo.initEdit({textures: [texture], bitmap: true});
							texture.activateLayers(false);
							layer = texture.getActiveLayer();
							layers = [layer];
							initial_offsets.set(layer, layer.offset.slice());
						/*} else if (event.altKey || Pressing.overrides.alt) {
							Undo.initEdit({textures: [texture], bitmap: true});
							let old_layer = texture.selected_layer;
							SharedActions.runSpecific('duplicate', 'layer', event, layer, true);
							layer = texture.selected_layer;
							old_layer.resolveLimbo(true);*/
						} else {
							Undo.initEdit({layers, bitmap: true});
						}
						selection_polygon.empty();
						texture.selection.clear();
						UVEditor.updateSelectionOutline();
					}
					for (let layer2 of layers) {
						layer2.offset[0] = initial_offsets.get(layer2)[0] + x - start_x;
						layer2.offset[1] = initial_offsets.get(layer2)[1] + y - start_y;
					}
					Blockbench.setCursorTooltip(`${x - start_x} x ${y - start_y}`);
					texture.updateLayerChanges();
					UVEditor.vue.$forceUpdate();
				}
				started_movement = true;
			}
			function stop() {
				removeEventListeners(document, 'pointermove', drag);
				removeEventListeners(document, 'pointerup', stop);
				selection_rect.active = false;
				Blockbench.setCursorTooltip();

				if (create_selection) {
					if ((!calcrect || selection_rect.width == 0 || selection_rect.height == 0) && selection_mode != 'lasso') {
						if (!texture.selection.hasSelection()) {
							texture.selection.clear();
							UVEditor.updateSelectionOutline();
							Undo.finishSelection('Unselect texture area');
						}
						if (TextureLayer.selected?.in_limbo) {
							TextureLayer.selected.resolveLimbo();
						}
						return;
					}

					if (op_mode == 'create' && selection_mode != 'lasso') {
						texture.selection.clear();
					}
					if (selection_mode == 'rectangle') {
						for (let x = calcrect.ax; x < calcrect.bx; x++) {
							for (let y = calcrect.ay; y < calcrect.by; y++) {
								switch (op_mode) {
									case 'create': case 'add': {
										texture.selection.set(x, y, 1);
										break;
									}
									case 'subtract': {
										texture.selection.set(x, y, 0);
										break;
									}
									case 'intersect': {
										if (texture.selection.get(x, y)) {
											texture.selection.set(x, y, 2);
										}
										break;
									}
								}
							}
						}
					}
					if (selection_mode == 'ellipse') {
						let center_x = calcrect.ax + calcrect.x/2;
						let center_y = calcrect.ay + calcrect.y/2;
						for (let x = calcrect.ax; x < calcrect.bx; x++) {
							for (let y = calcrect.ay; y < calcrect.by; y++) {
								let distance = Math.sqrt(Math.pow((center_x - x - 0.5) / calcrect.x, 2) + Math.pow((center_y - y - 0.5) / calcrect.y, 2));
								if (distance > 0.5) continue;
								switch (op_mode) {
									case 'create': case 'add': {
										texture.selection.set(x, y, 1);
										break;
									}
									case 'subtract': {
										texture.selection.set(x, y, 0);
										break;
									}
									case 'intersect': {
										if (texture.selection.get(x, y)) {
											texture.selection.set(x, y, 2);
										}
										break;
									}
								}
							}
						}
					}
					if (selection_mode == 'lasso' && scope.isSelectionPolygonClosed()) {
						selection_polygon.pop();
						let min_x = Infinity, min_y = Infinity, max_x = 0, max_y = 0;
						for (let point of selection_polygon) {
							min_x = Math.min(point[0], min_x);
							min_y = Math.min(point[1], min_y);
							max_x = Math.max(point[0], max_x);
							max_y = Math.max(point[1], max_y);
						}
						min_x = Math.clamp(min_x, 0, UVEditor.texture.img.naturalWidth);
						min_y = Math.clamp(min_y, 0, UVEditor.texture.img.naturalHeight);
						max_x = Math.clamp(max_x, 0, UVEditor.texture.img.naturalWidth);
						max_y = Math.clamp(max_y, 0, UVEditor.texture.img.naturalHeight);
						for (let x = Math.floor(min_x); x < max_x; x++) {
							for (let y = Math.floor(min_y); y < max_y; y++) {
								let is_inside = pointInPolygon([x+0.5, y+0.5], selection_polygon);
								if (!is_inside) continue;
								switch (op_mode) {
									case 'create': case 'add': {
										texture.selection.set(x, y, 1);
										break;
									}
									case 'subtract': {
										texture.selection.set(x, y, 0);
										break;
									}
									case 'intersect': {
										if (texture.selection.get(x, y)) {
											texture.selection.set(x, y, 2);
										}
										break;
									}
								}
							}
						}
						selection_polygon.empty();
					}
					if (op_mode == 'intersect') {
						for (let x = 0; x < texture.width; x++) {
							for (let y = 0; y < texture.height; y++) {
								let val = texture.selection.getDirect(x, y);
								if (val == 2) {
									texture.selection.set(x, y, 1);
								} else if (val == 1) {
									texture.selection.set(x, y, 0);
								}
							}
						}
					}
					if (!texture.selection.hasSelection()) {
						texture.selection.clear();
					}
					Undo.finishSelection('Select texture area');
					UVEditor.updateSelectionOutline();
					Interface.addSuggestedModifierKey('alt', 'modifier_actions.drag_to_duplicate');

				} else if (!started_movement) {
					if (TextureLayer.selected?.in_limbo) {
						TextureLayer.selected.resolveLimbo();
					}
					if (Toolbox.selected.id == 'move_layer_tool') {
						// select
						let layers_reverse = texture.layers.slice().reverse();
						for (let layer of layers_reverse) {
							let {offset} = layer;
							if (x >= offset[0] && y >= offset[1] && x < offset[0] + layer.width && y < offset[1] + layer.height) {
								let data = layer.ctx.getImageData(x - offset[0], y - offset[1], 1, 1);
								if (data.data[3] > 10) {
									layer.select();
									break;
								}
							}
						}
					}
				} else {
					texture.updateLayerChanges(true);
					texture.saved = false;
					Undo.finishEdit('Move layer');
				}
			}
			addEventListeners(document, 'pointermove', drag);
			addEventListeners(document, 'pointerup', stop);
		},
		resizeLayer(event, dir_x, dir_y) {
			if (event.which == 2 || event.which == 3 || !this.texture || !this.layer) return;
			convertTouchEvent(event);
			let layers = this.texture.layers.filter(l => l.selected && l instanceof TextureLayer);
			event.stopPropagation();

			Undo.initEdit({layers});

			let pre = layers.map(layer => {
				return {
					target_size: [layer.scaled_width, layer.scaled_height],
					last_target_size: [layer.scaled_width, layer.scaled_height],
					initial_size: [layer.width, layer.height]
				}
			});
			if (dir_x && dir_y) Interface.addSuggestedModifierKey('alt', 'modifier_actions.no_uniform_scaling');
			this.drag({
				event,
				onDrag: (x, y, e1) => {
					for (let i = 0; i < layers.length; i++) {
						let layer = layers[i];
						let {target_size, last_target_size, initial_size} = pre[i];
						last_target_size.replace(target_size);
						target_size[0] = Math.max(target_size[0] + (x * dir_x), 0);
						target_size[1] = Math.max(target_size[1] + (y * dir_y), 0);
						if (!(e1.ctrlOrCmd || Pressing.overrides.ctrl) && dir_x && dir_y) {
							target_size[1] = Math.round(target_size[0] * (initial_size[1] / initial_size[0]));
						}
						x = target_size[0] - last_target_size[0];
						y = target_size[1] - last_target_size[1];
						if (dir_x == -1) layer.offset[0] -= x;
						if (dir_y == -1) layer.offset[1] -= y;

						layer.scale[0] = target_size[0] / initial_size[0];
						layer.scale[1] = target_size[1] / initial_size[1];
					}
					let target_size = pre[0].target_size;
					Blockbench.setCursorTooltip(`${target_size[0]} x ${target_size[1]}\n${Math.round(layers[0].scale[0] * 100)}% x ${Math.round(layers[0].scale[1] * 100)}%`);
					this.texture.updateLayerChanges();
					UVEditor.vue.$forceUpdate();

					return [x * dir_x, y * dir_y];
				},
				onEnd: () => {
					this.texture.updateLayerChanges(true);
					this.texture.saved = false;
					Undo.finishEdit('Resize layer');
					Blockbench.setCursorTooltip();
					if (dir_x && dir_y) Interface.removeSuggestedModifierKey('alt', 'modifier_actions.no_uniform_scaling');
				},
				snap: 1,
				uv_grid: false
			})
		},
		getUVSelectionFrameStyle() {
			let box = this.getSelectedUVBoundingBox();
			if (!box) return {};
			return {
				left: this.toPixels(box[0], 0),
				top: this.toPixels(box[1], 0),
				width: this.toPixels(box[2] - box[0], 0),
				height: this.toPixels(box[3] - box[1], 0),
			};
		},
		focusOnSelection(event) {
			UVEditor.focusOnSelection(event);
		},
		showTransparentFaceText() {
			return UVEditor.getSelectedFaces(this.mappable_elements[0]).length;
		},
		isFaceSelected(element, fkey) {
			if (this.mode == 'paint') return false;
			if (!element) element = this.mappable_elements[0];
			if (element.getTypeBehavior('select_faces') == false) return true;
			return UVEditor.getSelectedFaces(element).indexOf(fkey) != -1;
		},
		isTransformingLayer() {
			if (!this.texture || !this.texture.selected_layer) return false;
			let tool = Toolbox.selected;
			if (tool.id == 'move_layer_tool' || (tool.id == 'selection_tool' && settings.move_with_selection_tool.value && TextureLayer.selected?.in_limbo)) {
				return true;
			}
			return false;
		},
		getLinePreviewAngle() {
			let angle = Math.atan2(this.last_brush_position[1] - this.mouse_coords.y, this.last_brush_position[0] - this.mouse_coords.x);
			return Math.radToDeg(angle);
		},
		getLinePreviewStyle() {
			let tex = this.texture;
			let pixel_size = this.inner_width / (tex ? tex.width : Project.texture_width);
			let length = Math.sqrt(Math.pow(this.mouse_coords.x - this.last_brush_position[0], 2) + Math.pow(this.mouse_coords.y - this.last_brush_position[1], 2));
			let angle = this.getLinePreviewAngle();
			return {
				width: length * pixel_size + 'px',
				rotate: angle + 'deg'
			};
		},
		getBrushPositionText() {
			if (!this.mouse_coords.active) return '';
			let string = trimFloatNumber(this.mouse_coords.x, 1) + ', ' + trimFloatNumber(this.mouse_coords.y, 1);
			return string;
		},

		checkFormat(values) {
			for (let key in values) {
				if (Format[key] != values[key]) return false;
			}
			return true;
		},
		toggleFaceEnabled(key, event) {
			let value = this.mappable_elements[0].faces[key].texture === null;
			Undo.initEdit({elements: Cube.selected, uv_only: true})
			UVEditor.forCubes(obj => {
				let faces = UVEditor.getFaces(obj, event);
				if (!faces.includes(key)) {
					faces = [key];
				}
				for (let side of faces) {
					if (!value) {
						obj.faces[side].texture = null;
						
					} else if (obj.faces[side].texture === null) {
						let value = false;
						for (let fkey in obj.faces) {
							let face = obj.faces[fkey];
							if (fkey != side && face.texture) {
								value = face.texture;
								break;
							}
						}
						obj.faces[side].texture = value;
					}
				}
				obj.preview_controller.updateFaces(obj);
			})
			UVEditor.loadData()
			Undo.finishEdit('Toggle face')
			Canvas.updateSelectedFaces()
		},
		openFaceTextureMenu(event) {
			let menu = new Menu(Texture.all.map(tex => {
				return {
					name: tex.name,
					icon: tex.img,
					marked: tex == UVEditor.texture,
					click(event) {
						UVEditor.applyTexture(tex);
					}
				}
			}))
			menu.open(event.target);
		},
		toggleFaceTint(key, event) {
			Undo.initEdit({elements: Cube.selected, uv_only: true})
			let value = UVEditor.getFirstMappableElement()?.faces[key]?.tint === -1 ? 0 : -1;
			UVEditor.forCubes(cube => {
				cube.faces[key].tint = value;
			})
			this.$forceUpdate();
			Undo.finishEdit('Toggle face tint')
		},
		changeFaceTint(key, event) {
			Undo.initEdit({elements: Cube.selected, uv_only: true})
			let value = parseInt(event.target.value);
			UVEditor.forCubes(cube => {
				cube.faces[key].tint = value;
			})					
			Undo.finishEdit('Set face tint');
		},
		setCullface(key, value) {
			Undo.initEdit({elements: Cube.selected, uv_only: true})
			UVEditor.forCubes(obj => {
				if (obj.faces[key]) {
					obj.faces[key].cullface = value;
				}
			})
			Undo.finishEdit(value ? `Set cullface to ${value}` : 'Disable cullface');
		},
		startInputMaterialInstance(event) {
			Undo.initEdit({elements: Cube.selected, uv_only: true})
		},
		endInputMaterialInstance(event, fkey) {
			let value = this.mappable_elements[0]?.faces[fkey]?.material_name;
			if (typeof value == 'string') {
				for (let element of this.mappable_elements) {
					if (element.faces[fkey]) {
						element.faces[fkey].material_name = value;
					}
				}
			}
			Undo.finishEdit('Change material instances');
		},
		showInfoBox(title, text) {
			Blockbench.showMessageBox({
				title: tl(title),
				message: tl(text),
				icon: 'info'
			})
		}
	}
}
</script>