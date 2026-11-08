import React, { useEffect, useRef } from 'react';

const vertexShader = `#version 300 es
in vec2 position;
out vec2 uv;
void main() {
  uv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}`;

const fragmentShader = `#version 300 es
precision highp float;
uniform vec2 resolution;
uniform float time;
in vec2 uv;
out vec4 color;
void main() {
  vec2 p = uv - vec2(0.74, 0.48);
  p.x *= resolution.x / resolution.y;
  float drift = sin(time * 0.18) * 0.035;
  float glow = exp(-dot(p - vec2(drift, 0.0), p - vec2(drift, 0.0)) * 5.2);
  float halo = exp(-abs(length(p) - 0.38) * 16.0);
  color = vec4(1.0, 0.42, 0.72, glow * 0.15 + halo * 0.035);
}`;

function compileShader(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Unable to create Driftlab shader.');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) || 'Unknown Driftlab shader error.';
    gl.deleteShader(shader);
    throw new Error(message);
  }
  return shader;
}

export const DriftHero: React.FC<React.PropsWithChildren<{ className?: string }>> = ({ children, className = '' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (motionPreference.matches) return;

    let frame = 0;
    let gl: WebGL2RenderingContext | null = null;
    let program: WebGLProgram | null = null;
    let buffer: WebGLBuffer | null = null;

    try {
      gl = canvas.getContext('webgl2', { alpha: true, antialias: false, powerPreference: 'low-power' });
      if (!gl) return;
      const vertex = compileShader(gl, gl.VERTEX_SHADER, vertexShader);
      const fragment = compileShader(gl, gl.FRAGMENT_SHADER, fragmentShader);
      program = gl.createProgram();
      if (!program) throw new Error('Unable to create Driftlab WebGL program.');
      gl.attachShader(program, vertex);
      gl.attachShader(program, fragment);
      gl.linkProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(program) || 'Unable to link Driftlab WebGL program.');
      }

      buffer = gl.createBuffer();
      if (!buffer) throw new Error('Unable to allocate Driftlab WebGL geometry.');
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
      gl.useProgram(program);
      const position = gl.getAttribLocation(program, 'position');
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
      const resolution = gl.getUniformLocation(program, 'resolution');
      const time = gl.getUniformLocation(program, 'time');
      const resize = () => {
        const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
        const width = Math.max(1, Math.floor(canvas.clientWidth * ratio));
        const height = Math.max(1, Math.floor(canvas.clientHeight * ratio));
        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width;
          canvas.height = height;
          gl?.viewport(0, 0, width, height);
        }
      };
      const observer = new ResizeObserver(resize);
      observer.observe(canvas);
      resize();

      const render = (now: number) => {
        if (gl) {
          gl.uniform2f(resolution, canvas.width, canvas.height);
          gl.uniform1f(time, now / 1000);
          gl.drawArrays(gl.TRIANGLES, 0, 6);
        }
        frame = window.requestAnimationFrame(render);
      };
      const stop = () => {
        if (!frame) return;
        window.cancelAnimationFrame(frame);
        frame = 0;
      };
      const start = () => {
        if (!frame && document.visibilityState === 'visible' && !motionPreference.matches) {
          frame = window.requestAnimationFrame(render);
        }
      };
      const updateVisibility = () => {
        if (document.visibilityState === 'visible' && !motionPreference.matches) start();
        else stop();
      };
      document.addEventListener('visibilitychange', updateVisibility);
      motionPreference.addEventListener('change', updateVisibility);
      start();
      return () => {
        document.removeEventListener('visibilitychange', updateVisibility);
        motionPreference.removeEventListener('change', updateVisibility);
        stop();
        observer.disconnect();
        if (gl) {
          if (buffer) gl.deleteBuffer(buffer);
          if (program) gl.deleteProgram(program);
          gl.getExtension('WEBGL_lose_context')?.loseContext();
        }
      };
    } catch (error) {
      console.warn('Driftlab WebGL background unavailable; using static artwork.', error);
      if (gl) gl.getExtension('WEBGL_lose_context')?.loseContext();
      return undefined;
    }
  }, []);

  return (
    <div className={`drift-hero ${className}`}>
      <img className="drift-hero-sky" src="/driftlab-sky.svg" alt="" aria-hidden="true" />
      <canvas ref={canvasRef} className="drift-hero-webgl" aria-hidden="true" />
      <img className="drift-hero-jelly" src="/driftlab-jellyfish.svg" alt="" aria-hidden="true" />
      <div className="drift-hero-shade" aria-hidden="true" />
      <div className="drift-hero-content">{children}</div>
    </div>
  );
};
