const Bottle = require('bottlejs');
const app = require('./core/app');

const bottle = new Bottle();
const container = bottle.container;

container.app = app;
container.renderer = app.renderer;
container.collisions = app.collisions;
container.scene = app.renderer.scene;
container.camera = app.renderer.camera;

module.exports = container;