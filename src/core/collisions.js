const guid = require('./guid');

class Collisions {
  constructor(props) {
    this.map = {};
    this.app = props.app;
  }

  add(body) {
    if (body._id == null) {
      body._id = guid();
    }

    body.group = body.group || 'default';
    body.mask = body.mask || ['default'];

    if (this.map[body.group] == null) {
      this.map[body.group] = {};
    }
    this.map[body.group][body._id] = body;
  }

  remove(body) {
    delete this.map[body.group][body._id];
  }

  tick() {
    let a, b, group2;

    const resolved = {};

    for (let group in this.map) {
      for (let id in this.map[group]) {
        a = this.map[group][id];

        if (a.static) {
          continue;
        }

        for (let i = 0; i < a.mask.length; i++) {
          group2 = this.map[a.mask[i]];
          for (let id2 in group2) {
            b = group2[id2];

            if (a === b) {
              continue;
            }

            if (resolved[a._id] != null && resolved[a._id][b._id]) {
            	continue;
            }

            // Resolve a, b				
            if (a.type === 'ray' && b.type === 'mesh') {
              this.hitTestRayMesh(a, b);
            } else if (a.type === 'mesh' && b.type === 'ray') {
              this.hitTestRayMesh(b, a);
            } else if (a.type === 'mesh' && b.type === 'mesh') {
              this.hitTestMeshMesh(a, b);
            }

            // Mark resolved
            if (resolved[a._id] == null) {
            	resolved[a._id] = {};
            }
            resolved[a._id][b._id] = true;
            if (resolved[b._id] == null) {
            	resolved[b._id] = {};
            }
            resolved[b._id][a._id] = true;
          }
        }
      }
    }
  }

  hitTestRayMesh(ray, mesh) {
    const delta = this.app.delta;

    const raycaster = ray.raycaster;
    const results = raycaster.intersectObject(mesh.mesh, true);

    if (results.length === 0) {
      return;
    }

    if (ray.onCollision != null) {
      ray.onCollision({
        results: results,
        body: mesh
      });
    }

    if (mesh.onCollision != null) {
      mesh.onCollision({
        results: results,
        body: ray
      });
    }
  }

  hitTestMeshMesh(a, b) {
    if (a.mesh.geometry.boundingSphere == null) {
      a.mesh.geometry.computeBoundingSphere();
    }
    if (b.mesh.geometry.boundingSphere == null) {
      b.mesh.geometry.computeBoundingSphere();
    }

    const dis = a.mesh.position.distanceTo(b.mesh.position);
    const minDis = a.mesh.geometry.boundingSphere.radius + b.mesh.geometry.boundingSphere.radius;
    
    if (dis > minDis) {
      return;
    }

    if (a.onCollision != null) {
      a.onCollision({
        dis: dis,
        minDis: minDis,
        body: b
      });
    }

    if (b.onCollision != null) {
      b.onCollision({
        dis: dis,
        minDis: minDis,
        body: a
      });
    } 
  }
};

module.exports = Collisions;
