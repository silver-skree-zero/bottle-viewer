//import * as THREE from 'three';

export const ContrastSaturationShader = {
  uniforms: {
    tDiffuse: { value: null },
    contrast: { value: 1.1 },    // 1.0 = no change
    saturation: { value: 1.15 }  // 1.0 = no change
  },

  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,

  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float contrast;
    uniform float saturation;
    varying vec2 vUv;

    void main() {
      vec4 color = texture2D(tDiffuse, vUv);

      // Contrast
      color.rgb = (color.rgb - 0.5) * contrast + 0.5;

      // Saturation
      float luma = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));
      color.rgb = mix(vec3(luma), color.rgb, saturation);

      gl_FragColor = color;

      color.rgb += vec3(0.04); // tiny lift only
    }
  `
};