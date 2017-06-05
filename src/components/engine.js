const container = require('../container');
const ParticleSystem = require('./particlesystem');

class Engine {
  constructor(props) {
    this.props = props;
    this.object = new THREE.Object3D();
    this.scene = container.scene;
    this.app = container.app;
    this.particleVelocity = new THREE.Vector3();
    this.amount = 0;

    this.particleSystem = this.app.add(ParticleSystem, {
      scale: [ ((p) => {
      	return p._size;
      }), 0],
      life: ((p) => {
        return p._size * 150;
      }),
      interval: 30,
      velocity: this.particleVelocity,
      autoPlay: false,
      onParticle: (p) => {
        p._size = Math.random() + 1;
      }
    });
  }

  start() {
    const ship = this.props.ship;
    const coord = this.props.coord;
    ship.innerObject.add(this.object);
    this.object.position
      .fromArray(coord)
      .add(new THREE.Vector3(0.5, 0.5, 0.5))
      .add(new THREE.Vector3(0, 0, 1));

    this.updateParticleSystem();
  }

  tick(dt) {
    this.updateParticleSystem();
  }

  destroy() {
    this.app.destroy(this.particleSystem);
  }

  updateParticleSystem() {
    this.particleSystem.amount = Math.abs(this.amount);
    if (this.amount === 0 && this.particleSystem.playing) {
      this.particleSystem.pause();
    } else if (this.amount > 0 && !this.particleSystem.playing) {
      this.particleSystem.play();
    }
    this.particleSystem.position.copy(this.object.getWorldPosition());
    const rotation = this.object.getWorldRotation();
    const direction = new THREE.Vector3(0, 0, 1).applyEuler(rotation);
    this.particleVelocity.copy(direction.multiplyScalar(10));
  }
};

module.exports = Engine;
