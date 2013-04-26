/*
 * matrix.c
 * Matrix manipulation functions.
 * from: http://code.google.com/p/spinningcube/
 *
 * license: apache 2.0
 */

#include "matrix.h"

/* 
 * Simulates desktop's glRotatef. The matrix is returned in column-major 
 * order. 
 */
void rotate_matrix(double angle, double x, double y, double z, float *R) {
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
