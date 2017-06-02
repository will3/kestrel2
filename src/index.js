const THREE = require('three');

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 5;
const geometry = new THREE.BoxGeometry(1, 1, 1);
const material = new THREE.MeshBasicMaterial({
	color: 0xff0000
});
const mesh = new THREE.Mesh(geometry, material);
scene.add(mesh);

const render = () => {
	renderer.render(scene, camera);
};

const animate = () => {
	render();
	requestAnimationFrame(animate);
};

const onResize = () => {
	renderer.setSize(window.innerWidth, window.innerHeight);
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
};

window.addEventListener('resize', onResize);

animate();