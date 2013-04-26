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
 * Simulates desktop's glRotatef. The matrix is returned in column-major 
 * order. 
 */
void translate_matrix(double xt, double yt, double zt, float *T) {
    for (int i = 0; i < 16; i++) {
        T[i] = 0.0;
    }

    T[0] = 1.0;
    T[5] = 1.0;
    T[10] = 1.0;
    T[15] = 1.0;
    T[3] = xt;
    T[7] = yt;
    T[11] = zt;
}
/* 
 * Simulates gluPerspectiveMatrix 
 */
void perspective_matrix(double fovy, double aspect, double znear, double zfar, float *P) {
    int i;
    double f;

    f = 1.0/tan(fovy * 0.5);

    for (i = 0; i < 16; i++) {
        P[i] = 0.0;
    }

    P[0] = f / aspect;
    P[5] = f;
    P[10] = (znear + zfar) / (znear - zfar);
    P[11] = -1.0;
    P[14] = (2.0 * znear * zfar) / (znear - zfar);
    P[15] = 0.0;
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
