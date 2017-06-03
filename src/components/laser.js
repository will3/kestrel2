const container = require('../container');

class Laser {
  constructor(props) {
    this.target = props.target;
    this.turrent = props.turrent;

    this.scene = container.scene;
    this.app = container.app;

    this.object = new THREE.Sprite();

    this.speed = 40;

    this.life = 10000;
  }

  start() {
  	this.object.position.copy(this.turrent.position);
  	this.scene.add(this.object);

  	this.velocity = this.target.position.clone().sub(this.turrent.position).normalize().multiplyScalar(this.speed);

  	this.dieTime = new Date().getTime() + this.life;
  }

  destroy() {
  	this.scene.remove(this.object);
  }

  tick(dt) {
  	this.object.position.add(this.velocity.clone().multiplyScalar(dt));

  	if (new Date().getTime() > this.dieTime) {
  		this.app.destroy(this);
  	}
  }
}

module.exports = Laser;
