const mesher = require('./monotone').mesher;

const meshRegion = (region, object, material) => {
	if (region.mesh != null) {
		object.remove(region.mesh);
		region.mesh.geometry.dispose();
	}

	const geometry = new THREE.Geometry();
	const mesh = new THREE.Mesh(geometry, material);

	const chunk = region.chunk;

	const f = chunk.get.bind(chunk);
	const dims = [ chunk.size, chunk.size, chunk.size ];

	const result = mesher(f, dims);

	result.vertices.forEach((v) => {
		geometry.vertices.push(new THREE.Vector3(v[0], v[1], v[2]));
	});

	result.faces.forEach((f) => {
		const face = new THREE.Face3(f[0], f[1], f[2]);
		face.materialIndex = f[3];
		geometry.faces.push(face);
	});

	object.add(mesh);
	region.mesh = mesh;
};

const meshChunks = (chunks, object, material) => {
	let id, region;
	for (id in chunks.map) {
		region = chunks.map[id];
		if (region.dirty) {
			meshRegion(region, object, material);
			region.dirty = false;
		}
	}
};

module.exports = meshChunks;