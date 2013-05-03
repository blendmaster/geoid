/*
 * matrix.c
 * Matrix manipulation functions.
 * from: http://code.google.com/p/spinningcube/
 *
 * license: apache 2.0
 */

#include "matrix.h"

/**
* Rotates a matrix by the given angle around the specified axis (from gl-matrix 1.3.7)
*
* @param {number} angle Angle (in radians) to rotate
* @param {x, y, z} the axis to rotate around
* @param {mat4} [dest] mat4 receiving operation result.
*/
void rotate_matrix(double angle, double x, double y, double z, float *dest) {

	double len = sqrt(x * x + y * y + z * z);

	if (!len) { return ; }
	if (len != 1.) {
		len = 1. / len;
		x *= len;
		y *= len;
		z *= len;
	}

	double s = sin(angle);
	double c = cos(angle);
	double t = 1 - c;

	float a00 = dest[0]; float a01 = dest[1]; float a02 = dest[2]; float a03 = dest[3];
	float a10 = dest[4]; float a11 = dest[5]; float a12 = dest[6]; float a13 = dest[7];
	float a20 = dest[8]; float a21 = dest[9]; float a22 = dest[10]; float a23 = dest[11];

	// Construct the elements of the rotation matrix
	float b00 = x * x * t + c; float b01 = y * x * t + z * s;float  b02 = z * x * t - y * s;
	float b10 = x * y * t - z * s; float b11 = y * y * t + c; float b12 = z * y * t + x * s;
	float b20 = x * z * t + y * s;float  b21 = y * z * t - x * s; float b22 = z * z * t + c;

	// Perform rotation-specific matrix multiplication
	dest[0] = a00 * b00 + a10 * b01 + a20 * b02;
	dest[1] = a01 * b00 + a11 * b01 + a21 * b02;
	dest[2] = a02 * b00 + a12 * b01 + a22 * b02;
	dest[3] = a03 * b00 + a13 * b01 + a23 * b02;

	dest[4] = a00 * b10 + a10 * b11 + a20 * b12;
	dest[5] = a01 * b10 + a11 * b11 + a21 * b12;
	dest[6] = a02 * b10 + a12 * b11 + a22 * b12;
	dest[7] = a03 * b10 + a13 * b11 + a23 * b12;

	dest[8] = a00 * b20 + a10 * b21 + a20 * b22;
	dest[9] = a01 * b20 + a11 * b21 + a21 * b22;
	dest[10] = a02 * b20 + a12 * b21 + a22 * b22;
	dest[11] = a03 * b20 + a13 * b21 + a23 * b22;
	return;
}

void rotate_then_translate_matrix(double angle, double x, double y, double z, double xt, double yt, double zt, float *R) {
    double radians, c, s, c1, u[3], length;
    int i, j;

    radians = (angle * M_PI) / 180.0;

    c = cos(radians);
    s = sin(radians);

    c1 = 1.0 - cos(radians);

    length = sqrt(x * x + y * y + z * z);

    u[0] = x / length;
    u[1] = y / length;
    u[2] = z / length;

    for (i = 0; i < 16; i++) {
        R[i] = 0.0;
    }

    R[15] = 1.0;
    R[3] = xt;
    R[7] = yt;
    R[11] = zt;

    for (i = 0; i < 3; i++) {
        R[i * 4 + (i + 1) % 3] = u[(i + 2) % 3] * s;
        R[i * 4 + (i + 2) % 3] = -u[(i + 1) % 3] * s;
    }

    for (i = 0; i < 3; i++) {
        for (j = 0; j < 3; j++) {
            R[i * 4 + j] += c1 * u[i] * u[j] + (i == j ? c : 0.0);
        }
    }
}
/* 
 * "Simulates desktop's glRotatef" (error?, actually translation).
 * The matrix is returned in column-major order.
 */
void translate_matrix(double xt, double yt, double zt, float *T) {
    for (int i = 0; i < 16; i++) {
        T[i] = 0.0;
    }

    T[0] = 1.0;
    T[5] = 1.0;
    T[10] = 1.0;
    T[15] = 1.0;
    T[12] = xt;
    T[13] = yt;
    T[14] = zt;
}


/**
* Generates a frustum matrix with the given bounds
*
* @param {number} left Left bound of the frustum
* @param {number} right Right bound of the frustum
* @param {number} bottom Bottom bound of the frustum
* @param {number} top Top bound of the frustum
* @param {number} near Near bound of the frustum
* @param {number} far Far bound of the frustum
* @param {mat4} [dest] mat4 frustum matrix will be written into
*
*/
static void frustrum(float left, float right, float bottom, float top, float near, float far, float *dest) {

	float rl = (right - left), tb = (top - bottom), fn = (far - near);

	dest[0] = (near * 2) / rl;
	dest[1] = 0;
	dest[2] = 0;
	dest[3] = 0;
	dest[4] = 0;
	dest[5] = (near * 2) / tb;
	dest[6] = 0;
	dest[7] = 0;
	dest[8] = (right + left) / rl;
	dest[9] = (top + bottom) / tb;
	dest[10] = -(far + near) / fn;
	dest[11] = -1;
	dest[12] = 0;
	dest[13] = 0;
	dest[14] = -(far * near * 2) / fn;
	dest[15] = 0;
}


/**
* Generates a perspective projection matrix with the given bounds
*
* @param {number} fovy Vertical field of view
* @param {number} aspect Aspect ratio. typically viewport width/height
* @param {number} near Near bound of the frustum
* @param {number} far Far bound of the frustum
* @param {mat4} [dest] mat4 frustum matrix will be written into
*
*/
void perspective_matrix(double fovy, double aspect, double near, double far, float *dest) {
	float top = near * tan(fovy * M_PI / 360.0),
	            right = top * aspect;
	frustrum(-right, right, -top, top, near, far, dest);
}

/* 
 * Multiplies A by B and writes out to C. All matrices are 4x4 and column
 * major. In-place multiplication is supported.
 */
void multiply_matrix(float *A, float *B, float *C) {
	int i, j, k;
    float aTmp[16];

    for (i = 0; i < 4; i++) {
        for (j = 0; j < 4; j++) {
            aTmp[j * 4 + i] = 0.0;

            for (k = 0; k < 4; k++) {
                aTmp[j * 4 + i] += A[k * 4 + i] * B[j * 4 + k];
            }
        }
    }

    for (i = 0; i < 16; i++) {
        C[i] = aTmp[i];
    }
}
