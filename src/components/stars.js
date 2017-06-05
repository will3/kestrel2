var randomUnitVector = require('../utils/math').randomUnitVector;
const container = require('../container');

module.exports = function() {
  var scene = container.scene;
  var dragCamera = container.dragCamera;
  var object = new THREE.Object3D();

  function start() {
    var spread = 1000;
    for (var i = 0; i < 120; i++) {
      var size = 2 + Math.pow(Math.random(), 3) * 8;
      var sprite = new THREE.Sprite();
      sprite.scale.set(size, size, size);
      var position = randomUnitVector().multiplyScalar(1000);
      sprite.position.copy(position);
      object.add(sprite);
    }
    scene.add(object);
  };

  function tick(dt) {
    object.position.copy(dragCamera.target);

    const scale = dragCamera.distance / 200;
    object.scale.set(scale, scale, scale);
  };

  function destroy() {
    scene.remove(object);
  };

  function random() {
    return Math.random() - 0.5;
  }

  return {
    start: start,
    tick: tick,
    destroy: destroy
  };
};
