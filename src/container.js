const Bottle = require('bottlejs');
const renderer = require('./renderer');

const bottle = new Bottle();
const container = bottle.container;

container.renderer = renderer;
container.scene = renderer.scene;
container.camera = renderer.camera;

module.exports = container;