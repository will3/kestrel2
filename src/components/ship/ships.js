const container = require('../../container');

class Ships {
  constructor() {
    this.app = container.app;
    container.ships = this;
    this.onAdd = this.onAdd.bind(this);
    this.onDestroy = this.onDestroy.bind(this);

    this.sides = {};
  }

  getTargets(ship) {
  	const targets = [];
  	for (let side in this.sides) {
      if (side === ship.side) {
        continue;
      }
  		for (let id in this.sides[side]) {
  			targets.push(this.sides[side][id]);
  		}
  	}

  	return targets;
  }

  onAdd(component) {
    if (!component.__isShip) {
			return;
    }

    if (this.sides[component.side] == null) {
    	this.sides[component.side] = {};
    }

    this.sides[component.side][component._id] = component;
  }

  onDestroy(component) {
    if (!component.__isShip) {
			return;
    }

    delete this.sides[component.side][component._id];
  }

  start() {
    for (let id in this.app.map) {
      this.onAdd(this.app.map[id]);
    }
    this.app.on('add', this.onAdd);
    this.app.on('destory', this.onDestroy);
  }

  destroy() {
  	this.app.off('add', this.onAdd);
  	this.app.off('destory', this.onDestroy);
  }
}

module.exports = Ships;
