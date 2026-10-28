CanvasRenderingContext2D.prototype.drawOutlinedDot = function(x, y, radius, style) {
	this.strokeStyle = style.stroke;
	this.lineWidth = style.thickness;
	this.beginPath();
	this.arc(x, y, radius, 0, 2 * Math.PI);
	this.stroke();
	this.fillStyle = style.fill;
	this.beginPath();
	this.arc(x, y, radius, 0, 2 * Math.PI);
	this.fill();
}
CanvasRenderingContext2D.prototype.drawLine = function(start, end, style) {
	this.lineWidth = style.thickness;
	this.strokeStyle = style.color;
	this.beginPath();
	this.moveTo(start[0], start[1]);
	this.lineTo(end[0], end[1]);
	this.stroke();
}