const randomUnitVector = () => {
  const theta = Math.random() * 2.0 * Math.PI;

  const rawX = Math.sin(theta);

  const rawY = Math.cos(theta);

  const z = Math.random() * 2.0 - 1.0;

  const phi = Math.asin(z);

  const scalar = Math.cos(phi);

  const x = rawX * scalar;

  const y = rawY * scalar;

  return new THREE.Vector3(x, y, z);  
}

const randomQuaternion = () => {
	const vector = randomUnitVector();
	return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), vector);
};

const normalizeAngle = (angle) => {
	angle %= (Math.PI * 2);
	if (angle > Math.PI) {
		angle -= Math.PI * 2;
	} else if (angle < -Math.PI) {
		angle += Math.PI * 2;
	}

	return angle;
};

const clamp = (v, min, max) => {
	if (v < min) {
		return min;
	} else if (v > max) {
		return max;
	}
	return v;
};

const linearBillboard = (camera, object, dir, quaternion) => {
	const a = object.position.clone().sub(camera.position).normalize();
	const b = a.clone().projectOnPlane(dir).normalize();
	const c = new THREE.Vector3(0, 0, 1).applyQuaternion(quaternion);

	const quat2 = new THREE.Quaternion().setFromUnitVectors(c, b);

	object.quaternion.copy(new THREE.Quaternion());
	object.quaternion.multiply(quat2);
	object.quaternion.multiply(quaternion);
}

module.exports = { randomUnitVector, randomQuaternion, normalizeAngle, clamp, linearBillboard };
