class Chunk {
	constructor(size) {
		this.size = size;
		this.yz = size * size;
		this.data = [];
	}

	get(i, j, k) {
		const index = i * this.yz + j * this.size + k;
		return this.data[index];
	}

	set(i, j, k, v) {
		const index = i * this.yz + j * this.size + k;
		this.data[index] = v;
	}
}

module.exports = Chunk;