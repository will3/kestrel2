const container = require('../container');

class Grid {
  constructor(props) {
    this.axis = [ 1, Math.sqrt(3) / 2, Math.sqrt(3) / 4 ];
    this.scene = container.scene;
  }

  hexToScreen(i, j) {
  	return [ this.axis[0] * i + ((j % 2 === 0) ? this.axis[2] : 0), this.axis[1] * j ];
  }

  start() {
    const width = 10;
    const height = 20;
    for (let i = 0; i < width; i++) {
      for (let j = 0; j < height; j++) {

        const sprite = new THREE.Sprite();
        const screen = this.hexToScreen(i - width / 2, j - height / 2);
        sprite.position.x = screen[0] * 10;
        sprite.position.z = screen[1] * 10;

        this.scene.add(sprite);
      }
    }
  }

  place(ships, side) {

  }
}

module.exports = Grid;
