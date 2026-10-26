CanvasRenderingContext2D.prototype.drawOutlinedDot = function(x, y, radius, style) {
	this.fillStyle = style.stroke;
	this.beginPath();
	this.arc(x, y, radius + 1, 0, 2 * Math.PI);
	this.stroke();
	this.fillStyle = style.fill;
	this.beginPath();
	this.arc(x, y, radius, 0, 2 * Math.PI);
	this.fill();
}