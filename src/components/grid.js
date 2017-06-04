const container = require('../container');

class Grid {
  constructor(props) {
    props = props || {};
    this.axis = [1, Math.sqrt(3) / 2];
    this.scene = container.scene;
    this.width = props.width || 100;
    this.height = props.height || 100;
    this.size = props.size || 12;
  }

  hexToCoord(i, j) {
    i -= this.width / 2;
    j -= this.height / 2;
    return [
      (this.axis[0] * i + ((j % 2 === 0) ? this.axis[1] / 2 : 0)) * this.size,
      this.axis[1] * j * this.size
    ];
  }

  getSurroundingCoords(coord) {
    const i = coord[0];
    const j = coord[1];

    if (j % 2 === 0) {
      return [
        [i - 1, j - 1],
        [i, j - 1],
        [i - 1, j],
        [i + 1, j],
        [i, j + 1],
        [i - 1, j + 1],
      ];
    } else {
      return [
        [i + 1, j - 1],
        [i, j - 1],
        [i - 1, j],
        [i + 1, j],
        [i, j + 1],
        [i + 1, j + 1],
      ];
    }
  }

  start() {
    for (let i = 0; i < this.width; i++) {
      for (let j = 0; j < this.height; j++) {

        const sprite = new THREE.Sprite();
        const screen = this.hexToCoord(i, j);
        sprite.position.x = screen[0];
        sprite.position.z = screen[1];

        // this.scene.add(sprite);
      }
    }
  }

  place(ships, side) {

  }
}

module.exports = Grid;
