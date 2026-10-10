<template v-for="element in getDisplayedUVElements()">
	<template v-if="element.getTypeBehavior('cube_faces') && !element.box_uv">
		<div class="cube_uv_face uv_face"
			v-for="(face, key) in element.faces" :key="element.uuid + ':' + key"
			v-if="(face.getTexture() == texture || texture == 0) && face.texture !== null && (display_uv !== 'selected_faces' || mode == 'paint' || isFaceSelected(element, key) || element.getTypeBehavior('select_faces') == false)"
			:title="face_names[key]"
			:class="{selected: isFaceSelected(element, key), unselected: display_uv === 'all_elements' && !mappable_elements.includes(element)}"
			@mousedown.prevent="dragFace(element, key, $event)"
			@touchstart.prevent="dragFace(element, key, $event)"
			@contextmenu="selectFace(element, key, $event, true, false)"
			:style="{
				left: toPixels(Math.min(face.uv[0], face.uv[2]), -1),
				top: toPixels(Math.min(face.uv[1], face.uv[3]), -1),
				'--width': toPixels(Math.abs(face.uv_size[0]), 2),
				'--height': toPixels(Math.abs(face.uv_size[1]), 2),
			}"
		>
			<template v-if="isFaceSelected(element, key) && mode == 'uv' && !(display_uv === 'all_elements' && !mappable_elements.includes(element))">
				{{ face_names[key] || '' }}
				<div class="uv_resize_side horizontal" @mousedown="resizeFace(key, $event, 0, -1)" @touchstart.prevent="resizeFace(key, $event, 0, -1)" style="width: var(--width)"></div>
				<div class="uv_resize_side horizontal" @mousedown="resizeFace(key, $event, 0, 1)" @touchstart.prevent="resizeFace(key, $event, 0, 1)" style="top: var(--height); width: var(--width)"></div>
				<div class="uv_resize_side vertical" @mousedown="resizeFace(key, $event, -1, 0)" @touchstart.prevent="resizeFace(key, $event, -1, 0)" style="height: var(--height)"></div>
				<div class="uv_resize_side vertical" @mousedown="resizeFace(key, $event, 1, 0)" @touchstart.prevent="resizeFace(key, $event, 1, 0)" style="left: var(--width); height: var(--height)"></div>
				<div class="uv_resize_corner uv_c_nw" :class="{main_corner: !face.rotation}" @mousedown="resizeFace(key, $event, -1, -1)" @touchstart.prevent="resizeFace(key, $event, -1, -1)" style="left: 0; top: 0">
					<div class="uv_rotate_field" v-if="cube_uv_rotation && face.rotation == 0" @mousedown.stop="rotateFace($event)" @touchstart.prevent.stop="rotateFace($event)"></div>
				</div>
				<div class="uv_resize_corner uv_c_ne" :class="{main_corner: face.rotation == 270}" @mousedown="resizeFace(key, $event, 1, -1)" @touchstart.prevent="resizeFace(key, $event, 1, -1)" style="left: var(--width); top: 0">
					<div class="uv_rotate_field" v-if="cube_uv_rotation && face.rotation == 270" @mousedown.stop="rotateFace($event)" @touchstart.prevent.stop="rotateFace($event)"></div>
				</div>
				<div class="uv_resize_corner uv_c_sw" :class="{main_corner: face.rotation == 90}" @mousedown="resizeFace(key, $event, -1, 1)" @touchstart.prevent="resizeFace(key, $event, -1, 1)" style="left: 0; top: var(--height)">
					<div class="uv_rotate_field" v-if="cube_uv_rotation && face.rotation == 90" @mousedown.stop="rotateFace($event)" @touchstart.prevent.stop="rotateFace($event)"></div>
				</div>
				<div class="uv_resize_corner uv_c_se" :class="{main_corner: face.rotation == 180}" @mousedown="resizeFace(key, $event, 1, 1)" @touchstart.prevent="resizeFace(key, $event, 1, 1)" style="left: var(--width); top: var(--height)">
					<div class="uv_rotate_field" v-if="cube_uv_rotation && face.rotation == 180" @mousedown.stop="rotateFace($event)" @touchstart.prevent.stop="rotateFace($event)"></div>
				</div>
			</template>
		</div>
	</template>
	
	<div v-if="element.getTypeBehavior('cube_faces') && element.box_uv" class="cube_box_uv uv_face"
		:key="element.uuid"
		@mousedown.prevent="dragFace(element, null, $event)"
		@touchstart.prevent="dragFace(element, null, $event)"
		@click.prevent="selectCube(element, $event)"
		:class="{unselected: display_uv === 'all_elements' && !mappable_elements.includes(element)}"
		:style="{left: toPixels(element.uv_offset[0]), top: toPixels(element.uv_offset[1])}"
	>
		<div class="uv_fill" v-if="element.size(1, 'box_uv') > 0" :style="{left: '-1px', top: toPixels(element.size(2, 'box_uv'), -1), width: toPixels(element.size(2, 'box_uv')*2 + element.size(0, 'box_uv')*2, 2), height: toPixels(element.size(1, 'box_uv'), 2)}" />
		<div class="uv_fill" v-if="element.size(0, 'box_uv') > 0" :style="{left: toPixels(element.size(2, 'box_uv'), -1), top: '-1px', width: toPixels(element.size(0, 'box_uv')*2, 2), height: toPixels(element.size(2, 'box_uv'), 2), borderBottom: element.size(1, 'box_uv') > 0 ? 'none' : undefined}" />
		<div :style="{left: toPixels(element.size(2, 'box_uv'), -1), top: element.size(0, 'box_uv') > 0 ? '-1px' : toPixels(element.size(2, 'box_uv'), -1), width: toPixels(element.size(0, 'box_uv'), 2), height: toPixels( (element.size(0, 'box_uv') > 0 ? element.size(2, 'box_uv') : 0) + element.size(1, 'box_uv'), 2), borderRight: element.size(0, 'box_uv') == 0 ? 'none' : undefined}" />
		<div v-if="element.size(1, 'box_uv') > 0 && element.size(0, 'box_uv') > 0" :style="{left: toPixels(element.size(2, 'box_uv')*2 + element.size(0, 'box_uv'), -1), top: toPixels(element.size(2, 'box_uv'), -1), width: toPixels(element.size(0, 'box_uv'), 2), height: toPixels(element.size(1, 'box_uv'), 2)}" />
	</div>

	<template v-if="element.type == 'mesh'">
		<div class="mesh_uv_face uv_face"
			v-for="(face, key) in filterMeshFaces(element)" :key="element.uuid + ':' + key"
			v-if="face.vertices.length > 2 && (display_uv !== 'selected_faces' || mode == 'paint' || isFaceSelected(element, key)) && face.getTexture() == texture"
			:class="{selected: isFaceSelected(element, key)}"
			@mousedown.prevent="dragFace(element, key, $event)"
			@touchstart.prevent="dragFace(element, key, $event)"
			:style="{
				left: toPixels(getMeshFaceCorner(face, 0), -1),
				top: toPixels(getMeshFaceCorner(face, 1), -1),
				width: toPixels(getMeshFaceWidth(face, 0), 2),
				height: toPixels(getMeshFaceWidth(face, 1), 2),
			}"
		>
			<svg>
				<polygon :points="getMeshFaceOutline(face)" />
			</svg>
			<template v-if="mode == 'uv' && isFaceSelected(element, key)">
				<div class="uv_mesh_vertex" v-for="(key, index) in face.vertices"
					:class="{main_corner: index == 0, selected: element.getSelectedVertices().includes(key)}"
					@mousedown.prevent.stop="dragVertices(element, key, $event)" @touchstart.prevent.stop="dragVertices(element, key, $event)"
					:style="{left: toPixels( face.uv[key][0] - getMeshFaceCorner(face, 0) ), top: toPixels( face.uv[key][1] - getMeshFaceCorner(face, 1) )}"
				>
				</div>
			</template>
		</div>
	</template>

</template>

<script></script>