const container = require('../container');

class Laser {
  constructor(props) {
    this.target = props.target;
    this.turrent = props.turrent;

    this.scene = container.scene;
    this.app = container.app;
    this.collisions = container.collisions;

    this.object = new THREE.Sprite();
    this.object.scale.set(2, 2, 2);

    this.speed = 200;

    this.life = 10000;

    this.onCollision = this.onCollision.bind(this);

    this.body = {
      type: 'ray',
      raycaster: new THREE.Raycaster(),
      onCollision: this.onCollision
    };
  }

  onCollision(collision) {
    const entity = collision.body.entity;
    if (entity === this.turrent.ship) {
      return;
    }

    // Explosion
    this.app.destroy(this);
  }

  start() {
  	this.object.position.copy(this.turrent.position);
  	this.scene.add(this.object);

    const dis = this.turrent.position.distanceTo(this.target.position);
    const time = dis / this.speed;
    const leading = this.target.velocity.clone().multiplyScalar(time);
  	this.velocity = this.target.position.clone()
      .add(leading)
      .sub(this.turrent.position)
      .normalize()
      .multiplyScalar(this.speed);

  	this.dieTime = new Date().getTime() + this.life;

    this.collisions.add(this.body);
  }

  destroy() {
  	this.scene.remove(this.object);
    this.collisions.remove(this.body);
  }

  tick(dt) {
    const velocity = this.velocity.clone().multiplyScalar(dt);
  	this.object.position.add(velocity);

  	if (new Date().getTime() > this.dieTime) {
  		this.app.destroy(this);
  	}

    this.body.raycaster = new THREE.Raycaster(
      this.object.position, 
      velocity.clone().normalize(),
      0,
      velocity.length());
  }
}

module.exports = Laser;
