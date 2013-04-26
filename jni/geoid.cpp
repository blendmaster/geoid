#include <android_native_app_glue.h>

#include <errno.h>
#include <jni.h>
#include <sys/time.h>
#include <time.h>
#include <android/log.h>

#include <stdio.h>
#include <stdlib.h>
#include <math.h>
#include <float.h>
#include <queue>

#include <EGL/egl.h>
#include <GLES2/gl2.h>
#include <GLES2/gl2ext.h>

#include <opencv2/core/core.hpp>
#include <opencv2/features2d/features2d.hpp>
#include <opencv2/imgproc/imgproc.hpp>
#include <opencv2/highgui/highgui.hpp>

#include "matrix.h"

#define  LOG_TAG    "geoid_native"
#define  LOGD(...)  __android_log_print(ANDROID_LOG_DEBUG,LOG_TAG,__VA_ARGS__)
#define  LOGI(...)  __android_log_print(ANDROID_LOG_INFO,LOG_TAG,__VA_ARGS__)
#define  LOGW(...)  __android_log_print(ANDROID_LOG_WARN,LOG_TAG,__VA_ARGS__)
#define  LOGE(...)  __android_log_print(ANDROID_LOG_ERROR,LOG_TAG,__VA_ARGS__)

struct engine {
	android_app* app;
	cv::Ptr<cv::VideoCapture> capture;

	bool hasFocus;

	EGLDisplay display;
	EGLSurface surface;
	EGLContext context;
	int32_t width;
	int32_t height;

	GLuint gProgramCamera;
	GLuint gvPositionHandleCamera, gvTextureHandleCamera, gvTextureUniformHandleCamera;
	GLuint textureCamera;

	GLuint globeProgram;
	GLuint globeModelCoordHandle;
	GLuint globeTexCoordHandle;
	GLuint projectionMatrixHandle;
	GLuint modelViewMatrixHandle;
	GLuint globeTexture;
	GLuint globeTextureHandle;

	GLuint globeNumTriangles;
	std::vector<GLushort> globeIndices;
};

static void printGLString(const char *name, GLenum s) {
	const char *v = (const char *) glGetString(s);
	LOGI("GL %s = %s\n", name, v);
}

static void checkGlError(const char* op) {
	for (GLint error = glGetError(); error; error = glGetError()) {
		LOGE("after %s() glError (0x%x)\n", op, error);
	}
}

static const GLushort indices[] = { 0, 1, 2, 1, 3, 2 };

static const GLfloat gTriangleVertices[] = {
		0.8, 1.0, 0.0,
		-0.8, 1.0, 0.0,
		0.8, -1.0, 0.0,
		-0.8, -1.0, 0.0};
//static const GLfloat gTriangleVertices[] = {
//		-0.8, -1, 0,
//		0.8, -1, 0,
//		0.8, 1, 0,
//		-0.8, 1, 0};

static const GLfloat textureVertices[] = {
		1.0, 0.0,
		0.0, 0.0,
		1.0, 1.0,
		0.0, 1.0 };
//static const GLfloat textureVertices[] = {
//		1.0, 0.0,
//		1.0, 0.5,
//		1.0, 1.0,
//		1.0, 0.0 };

static const char gVertexShaderCamera[] =
		"attribute vec4 a_position;   \n"
     //   "attribute vec3 a_normal;     \n"
        "attribute vec2 a_texCoord;   \n"
        "varying vec2 v_texCoord;     \n"
       // "varying vec3 v_normal; \n"
        "void main()                  \n"
        "{                            \n"
        "   gl_Position = a_position; \n"
        //" v_normal = a_normal; \n"
        "   v_texCoord = a_texCoord;  \n"
        "}                            \n";

static const char gFragmentShaderCamera[] =
                        "precision mediump float;                            \n"
                        "varying vec2 v_texCoord;                            \n"
                       // "varying vec3 v_normal; \n"
                        "uniform sampler2D s_texture;                        \n"
                        "void main()                                         \n"
                        "{                                                   \n"
						"  gl_FragColor = texture2D( s_texture, v_texCoord );\n"
                        "}                                                   \n";

static const char gVertexShaderGlobe[] =
		    "precision mediump float;\n"

		    "attribute vec3 modelCoord;\n"
		    "attribute vec2 texCoord;\n"

		    "varying vec2 tex;\n"

		    "uniform mat4 ModelViewMatrix;\n"
		    "uniform mat4 ProjectionMatrix;\n"

		    "void main() {\n"
		      "tex = texCoord;\n"

		      "vec4 WorldCoord = ModelViewMatrix * vec4(modelCoord,1.0);\n"

		      "gl_Position = ProjectionMatrix * WorldCoord;\n"
		    "}";

static const char gFragmentShaderGlobe[] =
		"    precision mediump float;\n"

		"    uniform sampler2D texture;\n"

		"    varying vec2 tex; // coords\n"

		"    void main() {\n"
		"      gl_FragColor = vec4(0, 1.0, 0, 1.0);}"
//		"      vec3 val = texture2D(textureCamera, tex).xyz;\n"
//		"      vec2 current = vec2(val.x - 0.5, val.y - 0.5);\n"
//		"      float m = length(current);\n"
//
//		"      bool water = val.z != 0.0;\n"
//		"      if (water) {\n"
//		"        gl_FragColor = vec4(0, m, 0, 1.0);\n"
//		"      } else{\n"
//		"        gl_FragColor = vec4(0, 0, 0, 1.0);\n"
//		"      }\n"
		;

GLuint loadShader(GLenum shaderType, const char* pSource) {
	GLuint shader = glCreateShader(shaderType);
	if (shader) {
		glShaderSource(shader, 1, &pSource, NULL);
		glCompileShader(shader);
		GLint compiled = 0;
		glGetShaderiv(shader, GL_COMPILE_STATUS, &compiled);
		if (!compiled) {
			GLint infoLen = 0;
			glGetShaderiv(shader, GL_INFO_LOG_LENGTH, &infoLen);
			if (infoLen) {
				char* buf = (char*) malloc(infoLen);
				if (buf) {
					glGetShaderInfoLog(shader, infoLen, NULL, buf);
					LOGE("Could not compile shader %d:\n%s\n", shaderType, buf);
					free(buf);
				}
				glDeleteShader(shader);
				shader = 0;
			}
		}
	}
	return shader;
}

GLuint createProgram(const char* pVertexSource, const char* pFragmentSource) {
	GLuint vertexShader = loadShader(GL_VERTEX_SHADER, pVertexSource);
	if (!vertexShader) {
		return 0;
	}

	GLuint pixelShader = loadShader(GL_FRAGMENT_SHADER, pFragmentSource);
	if (!pixelShader) {
		return 0;
	}

	GLuint program = glCreateProgram();
	if (program) {
		glAttachShader(program, vertexShader);
		checkGlError("glAttachShader");
		glAttachShader(program, pixelShader);
		checkGlError("glAttachShader");
		glLinkProgram(program);
		GLint linkStatus = GL_FALSE;
		glGetProgramiv(program, GL_LINK_STATUS, &linkStatus);
		if (linkStatus != GL_TRUE) {
			GLint bufLength = 0;
			glGetProgramiv(program, GL_INFO_LOG_LENGTH, &bufLength);
			if (bufLength) {
				char* buf = (char*) malloc(bufLength);
				if (buf) {
					glGetProgramInfoLog(program, bufLength, NULL, buf);
					LOGE("Could not link program:\n%s\n", buf);
					free(buf);
				}
			}
			glDeleteProgram(program);
			program = 0;
		}
	}
	return program;
}

void createGlobeVertices(engine* engine);

bool setupGraphics(struct engine* engine) {
	printGLString("Version", GL_VERSION);
	printGLString("Vendor", GL_VENDOR);
	printGLString("Renderer", GL_RENDERER);
	printGLString("Extensions", GL_EXTENSIONS);

	int w = engine->width;
	int h = engine->height;

	LOGI("setupGraphics(%d, %d)", w, h);
	engine->gProgramCamera = createProgram(gVertexShaderCamera, gFragmentShaderCamera);
	if (!engine->gProgramCamera) {
		LOGE("Could not create program.");
		return false;
	}
	engine->gvPositionHandleCamera = glGetAttribLocation(engine->gProgramCamera,
			"a_position");
	checkGlError("glGetAttribLocation");

	engine->gvTextureHandleCamera = glGetAttribLocation(engine->gProgramCamera,
			"a_texCoord");
	checkGlError("glGetAttribLocation");

	engine->gvTextureUniformHandleCamera = glGetAttribLocation(engine->gProgramCamera,
				"s_texture");
	checkGlError("glGetAttribLocation");

	glViewport(0, 0, w, h);
	checkGlError("glViewport");

	// setup textureCamera
	glGenTextures(1, &engine->textureCamera);

	glActiveTexture(GL_TEXTURE0);
	checkGlError("glActiveTexture");
	glBindTexture(GL_TEXTURE_2D, engine->textureCamera);
	checkGlError("glBindTexture");

	// Use textureCamera 0
	glUniform1i(engine->gvTextureUniformHandleCamera, 0);

	glVertexAttribPointer(engine->gvTextureHandleCamera, 2, GL_FLOAT, GL_FALSE, 0,
			textureVertices);
	checkGlError("glVertexAttribPointer_texturehandle init");

	glEnableVertexAttribArray(engine->gvTextureHandleCamera);
	checkGlError("glEnableVertexAttribArray_textureHandle init");

	//glBindBuffer(GL_ARRAY_BUFFER, engine->gvPositionHandleCamera);
	glVertexAttribPointer(engine->gvPositionHandleCamera, 3, GL_FLOAT, GL_FALSE, 0,
			gTriangleVertices);
	checkGlError("glVertexAttribPointer_positon handle");

	// globe program
//	engine->globeProgram = createProgram(gVertexShaderGlobe, gFragmentShaderGlobe);
//	if (!engine->globeProgram) {
//		LOGE("Could not create program.");
//		return false;
//	}
//	engine->globeModelCoordHandle = glGetAttribLocation(engine->globeProgram,
//			"modelCoord");
//	checkGlError("glGetAttribLocation globe modelCoord");
//	LOGI("modelCoord handle: %i", engine->globeModelCoordHandle);
//
//	engine->globeTexCoordHandle = glGetAttribLocation(engine->globeProgram,
//			"texCoord");
//	checkGlError("glGetAttribLocation globe texCoord");
//	LOGI("texCoord handle: %i", engine->globeTexCoordHandle);
//
//	engine->globeTextureHandle = glGetAttribLocation(engine->globeProgram,
//				"texture");
//	checkGlError("glGetAttribLocationg globe texutre");
//
//	engine->modelViewMatrixHandle = glGetUniformLocation(engine->globeProgram,
//				"ModelViewMatrix");
//		checkGlError("glGetUniformLocation globe modelViewMatrix");
//		LOGI("MVM handle: %i", engine->modelViewMatrixHandle);
//
//	engine->projectionMatrixHandle = glGetUniformLocation(engine->globeProgram,
//					"ProjectionMatrix");
//			checkGlError("glGetUniformLocation globe projectionMatrix");
//			LOGI("PM handle: %i", engine->projectionMatrixHandle);
//
//	glUniform1i(engine->globeTextureHandle, 0);
//
//	glGenTextures(1, &engine->globeTexture);
//
//	createGlobeVertices(engine);
//
//	return true;
}

void createGlobeVertices(engine* engine) {
	const int latBands = 30, lonBands = 30;



	std::vector<GLfloat> modelCoords(31 * 31 * 3);
	std::vector<GLfloat> texCoords(31 * 31 * 2);

	int n = 0, m = 0;
	for (int i = 0; i <= latBands; ++i) {
		float theta = (float)i * M_PI / (float)latBands;
		float sinTheta = sin(theta);
		float cosTheta = cos(theta);
		for (int j = 0; j <= lonBands; ++j) {
			float phi = (float)j * M_PI_2 / (float)lonBands;
			float sinPhi = sin(phi);
			float cosPhi = cos(phi);

			modelCoords[n] = cosPhi * sinTheta;
			modelCoords[n + 1] = cosTheta;
			modelCoords[n + 2] = sinPhi * sinTheta;

			n += 3;

			texCoords[m] = 1 - (float)j / (float)lonBands;
			texCoords[m + 1] = 1 - (float)i / (float)latBands;

			m += 2;
		}
	}

	std::vector<GLushort> idx(latBands * lonBands * 6);

	n = 0;
	for (int i = 0; i < latBands; ++i) {
		for (int j = 0; j < lonBands; ++j) {
			int fst = i * (lonBands + 1) + j;
			int snd = fst + lonBands + 1;

			idx[n] = fst;
			idx[n + 1] = fst + 1;
			idx[n + 2] = snd;
			idx[n + 3] = snd;
			idx[n + 4] = fst + 1;
			idx[n + 5] = snd + 1;
		}
	}

	idx[0] = 0;
	idx[1] = 1;
	idx[2] = 2;
	idx[3] = 2;
	idx[4] = 1;
	idx[5] = 3;

	engine->globeIndices = idx;

	LOGI("idx size %i", idx.size());
	LOGI("model size %i", modelCoords.size());
	LOGI("tex size %i", texCoords.size());

	engine->globeNumTriangles = idx.size();

	// bind buffers. Not sure if the whole createBuffer/bindBuffer/bufferData is needed here
//	GLuint handle;
//	glGenBuffers(1, &handle);
//	checkGlError("glGenBuffers");
//	glBindBuffer(GL_ARRAY_BUFFER, handle);
//	checkGlError("glBindBuffer");
//	glBufferData(GL_ARRAY_BUFFER, latBands * lonBands * 3, &modelCoords[0], GL_STATIC_DRAW);
//	checkGlError("glBufferData model");

	glVertexAttribPointer(engine->globeModelCoordHandle, 3, GL_FLOAT, GL_FALSE, 0,
				gTriangleVertices); //&modelCoords[0]);
	checkGlError("glVertexAttribPointer globe model coords");
	glEnableVertexAttribArray(engine->globeModelCoordHandle);
	checkGlError("glENableVertexAttribArray model");

	// texture
//	glGenBuffers(1, &handle);
//	checkGlError("glGenBuffers");
//	glBindBuffer(GL_ARRAY_BUFFER, handle);
//	checkGlError("glBindBuffer");
//	glBufferData(GL_ARRAY_BUFFER, latBands * lonBands * 2, &texCoords[0], GL_STATIC_DRAW);
//	checkGlError("glBufferData tex");

	glVertexAttribPointer(engine->globeTexCoordHandle, 2, GL_FLOAT, GL_FALSE, 0,
		&texCoords[0]);
	checkGlError("glVertexAttribPointer globe tex coords");
	glEnableVertexAttribArray(engine->globeTexCoordHandle);
	checkGlError("glENableVertexAttribArray tex");

	return;
}

static void engine_draw_frame(engine* engine, const cv::Mat& frame) {
	if (engine->app->window == NULL)
		return;

	glClearColor(0, 0, 0, 1.0f);
	checkGlError("glClearColor");
	glClear(GL_DEPTH_BUFFER_BIT | GL_COLOR_BUFFER_BIT);
	checkGlError("glClear");
	glUseProgram(engine->gProgramCamera);
	checkGlError("glUseProgram");

	glActiveTexture(GL_TEXTURE0);
	checkGlError("glActiveTexture");
	glBindTexture(GL_TEXTURE_2D, engine->textureCamera);
	checkGlError("glBindTexture");

	glPixelStorei(GL_UNPACK_ALIGNMENT, 1);

	// these are necessary to get android to use a non-power-of-2 size texture.
	glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_NEAREST);
	glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_NEAREST);
	glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
	glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);

	glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA, frame.cols, frame.rows, 0,
			GL_RGBA, GL_UNSIGNED_BYTE, frame.data);
	checkGlError("glTexImage2D");

	glEnableVertexAttribArray(engine->gvTextureHandleCamera);
	checkGlError("glEnableVertexAttribArray_textureHandle");
	glEnableVertexAttribArray(engine->gvPositionHandleCamera);
	checkGlError("glEnableVertexAttribArray_positionHandle");
	glDrawElements(GL_TRIANGLES, 6, GL_UNSIGNED_SHORT, indices);
	checkGlError("glDrawElements");

	glDisableVertexAttribArray(engine->gvTextureHandleCamera);
	checkGlError("glDisableVertexAttribArray_textureHandle");
	glDisableVertexAttribArray(engine->gvPositionHandleCamera);
	checkGlError("glDisableVertexAttribArray_positionHandle");

	// then, draw globe on top
//	glClear(GL_DEPTH_BUFFER_BIT);
//	checkGlError("glClear");
//
//	glUseProgram(engine->globeProgram);
//	checkGlError("glUseProgram globe");
//
//	// set up uniforms
//	float perspective[16];
//	perspective_matrix(15.0, (double)engine->width / (double)engine->height, 0.01, 100, perspective);
//	glUniformMatrix4fv(engine->projectionMatrixHandle, 1, GL_FALSE, perspective);
//	checkGlError("glUniform projection matrix");
//
//	float modelView[16];
//	translate_matrix(0, 0, -3.732, modelView);
//	glUniformMatrix4fv(engine->modelViewMatrixHandle, 1, GL_FALSE, modelView);
//	checkGlError("glUniform ModelView matrix");
//
//	// bind texture
//	glActiveTexture(GL_TEXTURE0);
//	checkGlError("glActiveTexture");
//	glBindTexture(GL_TEXTURE_2D, engine->globeTexture);
//	checkGlError("glBindTexture");
//
//	glEnableVertexAttribArray(engine->globeTexCoordHandle);
//	checkGlError("glEnableVertexAttribArray texCoord");
//	glEnableVertexAttribArray(engine->globeModelCoordHandle);
//	checkGlError("glEnableVertexAttribArray modelCoord");
//	glDrawElements(GL_TRIANGLES, engine->globeNumTriangles, GL_UNSIGNED_SHORT, &(engine->globeIndices[0]));
////	glDrawElements(GL_TRIANGLES, 100, GL_UNSIGNED_SHORT, &(engine->globeIndices[0]));
//	checkGlError("glDrawElements globe");
//	glDisableVertexAttribArray(engine->globeTexCoordHandle);
//	checkGlError("glDisableVertexAttribArray texCoord");
//	glDisableVertexAttribArray(engine->globeModelCoordHandle);
//	checkGlError("glDisableVertexAttribArray modelCoord");

	//LOGI("opengl rendered, swapping buffers");
	eglSwapBuffers(engine->display, engine->surface);
}

// XXX fudging the X's here, since the camera preview is narrower than my nexus s' screen size.
/**
 * Initialize an EGL context for the current display.
 */
static int engine_init_display(struct engine* engine) {
	// initialize OpenGL ES and EGL

	/*
	 * Here specify the attributes of the desired configuration.
	 * Below, we select an EGLConfig with at least 8 bits per color
	 * component compatible with on-screen windows
	 */
	const EGLint attribs[] = { EGL_RENDERABLE_TYPE, EGL_OPENGL_ES2_BIT,
			EGL_SURFACE_TYPE, EGL_WINDOW_BIT, EGL_BLUE_SIZE, 8, EGL_GREEN_SIZE,
			8, EGL_RED_SIZE, 8, EGL_NONE };
	EGLint w, h, dummy, format;
	EGLint numConfigs;
	EGLConfig config;
	EGLSurface surface;
	EGLContext context;

	EGLDisplay display = eglGetDisplay(EGL_DEFAULT_DISPLAY);

	eglInitialize(display, 0, 0);

	/* Here, the application chooses the configuration it desires. In this
	 * sample, we have a very simplified selection process, where we pick
	 * the first EGLConfig that matches our criteria */
	eglChooseConfig(display, attribs, &config, 1, &numConfigs);

	/* EGL_NATIVE_VISUAL_ID is an attribute of the EGLConfig that is
	 * guaranteed to be accepted by ANativeWindow_setBuffersGeometry().
	 * As soon as we picked a EGLConfig, we can safely reconfigure the
	 * ANativeWindow buffers to match, using EGL_NATIVE_VISUAL_ID. */
	eglGetConfigAttrib(display, config, EGL_NATIVE_VISUAL_ID, &format);

	ANativeWindow_setBuffersGeometry(engine->app->window, 0, 0, format);

	surface = eglCreateWindowSurface(display, config, engine->app->window,
			NULL);

	EGLint AttribList[] = { EGL_CONTEXT_CLIENT_VERSION, 2, EGL_NONE };
	context = eglCreateContext(display, config, NULL, AttribList);

	if (eglMakeCurrent(display, surface, surface, context) == EGL_FALSE) {
		LOGW("Unable to eglMakeCurrent");
		return -1;
	}

	eglQuerySurface(display, surface, EGL_WIDTH, &w);
	eglQuerySurface(display, surface, EGL_HEIGHT, &h);

	engine->display = display;
	engine->context = context;
	engine->surface = surface;
	engine->width = w;
	engine->height = h;

	// Initialize GL state.
	glEnable(GL_CULL_FACE);
	glDisable(GL_DEPTH_TEST);

	return 0;
}

/**
 * Tear down the EGL context currently associated with the display.
 */
static void engine_term_display(struct engine* engine) {
	if (engine->display != EGL_NO_DISPLAY) {
		eglMakeCurrent(engine->display, EGL_NO_SURFACE, EGL_NO_SURFACE,
				EGL_NO_CONTEXT);
		if (engine->context != EGL_NO_CONTEXT) {
			eglDestroyContext(engine->display, engine->context);
		}
		if (engine->surface != EGL_NO_SURFACE) {
			eglDestroySurface(engine->display, engine->surface);
		}
		eglTerminate(engine->display);
	}
	engine->hasFocus = false;
	engine->display = EGL_NO_DISPLAY;
	engine->context = EGL_NO_CONTEXT;
	engine->surface = EGL_NO_SURFACE;
}

static cv::Size calc_optimal_camera_resolution(const char* supported, int width,
		int height) {
	int frame_width = 0;
	int frame_height = 0;

	size_t prev_idx = 0;
	size_t idx = 0;
	float min_diff = FLT_MAX;

	do {
		int tmp_width;
		int tmp_height;

		prev_idx = idx;
		while ((supported[idx] != '\0') && (supported[idx] != ','))
			idx++;

		sscanf(&supported[prev_idx], "%dx%d", &tmp_width, &tmp_height);

		int w_diff = width - tmp_width;
		int h_diff = height - tmp_height;
		if ((h_diff >= 0) && (w_diff >= 0)) {
			if ((h_diff <= min_diff) && (tmp_height <= 720)) {
				frame_width = tmp_width;
				frame_height = tmp_height;
				min_diff = h_diff;
			}
		}

		idx++; // to skip coma symbol

	} while (supported[idx - 1] != '\0');

	return cv::Size(frame_width, frame_height);
}

/**
 * Process the next input event.
 */
//static int32_t engine_handle_input(struct android_app* app,
//		AInputEvent* event) {
////	struct engine* engine = (struct engine*) app->userData;
////	if (AInputEvent_getType(event) == AINPUT_EVENT_TYPE_MOTION) {
////		// grab next frame's features
////		engine->grabFeatures = true;
////		return 1;
////	}
//	return 0;
//}

static void engine_handle_cmd(android_app* app, int32_t cmd) {
	struct engine* engine = (struct engine*) app->userData;
	switch (cmd) {
	case APP_CMD_INIT_WINDOW:
		if (app->window != NULL) {
			LOGI("APP_CMD_INIT_WINDOW");

			engine->capture = new cv::VideoCapture(0);

			union {
				double prop;
				const char* name;
			} u;
			u.prop = engine->capture->get(
					CV_CAP_PROP_SUPPORTED_PREVIEW_SIZES_STRING);

			int view_width = ANativeWindow_getWidth(app->window);
			int view_height = ANativeWindow_getHeight(app->window);

			cv::Size camera_resolution;
			if (u.name)
				camera_resolution = calc_optimal_camera_resolution(u.name, 640,
						480);
			else {
				LOGE("Cannot get supported camera camera_resolutions");
				camera_resolution = cv::Size(
						ANativeWindow_getWidth(app->window),
						ANativeWindow_getHeight(app->window));
			}

			if ((camera_resolution.width != 0)
					&& (camera_resolution.height != 0)) {
				engine->capture->set(CV_CAP_PROP_FRAME_WIDTH,
						camera_resolution.width);
				engine->capture->set(CV_CAP_PROP_FRAME_HEIGHT,
						camera_resolution.height);
			}

			float scale = std::min((float) view_width / camera_resolution.width,
					(float) view_height / camera_resolution.height);

			if (ANativeWindow_setBuffersGeometry(app->window,
					(int) (view_width / scale), int(view_height / scale),
					WINDOW_FORMAT_RGBA_8888) < 0) {
				LOGE("Cannot set pixel format!");
				return;
			}

			LOGI(
					"Camera initialized at resoution %dx%d", camera_resolution.width, camera_resolution.height);

			engine_init_display(engine);
			setupGraphics(engine);
		}
		break;
	case APP_CMD_GAINED_FOCUS:
		// start capturing frames
		engine->hasFocus = true;
		break;
	case APP_CMD_LOST_FOCUS:
		// stop capturing frames
		engine->hasFocus = false;
		break;
	case APP_CMD_TERM_WINDOW:
		LOGI("APP_CMD_TERM_WINDOW");

		engine_term_display(engine);
		engine->capture->release();
		break;
	}
}

void android_main(android_app* app) {
	engine engine;

	// Make sure glue isn't stripped.
	app_dummy();

	memset(&engine, 0, sizeof(engine));
	app->userData = &engine;
	app->onAppCmd = engine_handle_cmd;
//	app->onInputEvent = engine_handle_input;
	engine.app = app;

	float fps = 0;
	cv::Mat drawing_frame;
	std::queue<int64> time_queue;

	cv::Mat mask = cv::Mat::zeros(480, 640, CV_8U);
	cv::Scalar textColor(0, 255, 0);

	cv::Mat thresholded;

	std::vector<cv::Mat> hsv;
	// loop waiting for stuff to do.
	while (1) {
		// Read all pending events.
		int ident;
		int events;
		android_poll_source* source;

		// Process system events
		// if we don't have focus, block forever, otherwise capture continuously
		while ((ident = ALooper_pollAll(engine.hasFocus ? 0 : -1, NULL, &events,
				(void**) &source)) >= 0) {
			// Process this event.
			if (source != NULL) {
				source->process(app, source);
			}

			// Check if we are exiting.
			if (app->destroyRequested != 0) {
				LOGI("Engine thread destroy requested!");
				engine_term_display(&engine);
				return;
			}
		}

		int64 then;
		int64 now = cv::getTickCount();
		time_queue.push(now);

		// Capture frame from camera and draw it
		if (engine.hasFocus && !engine.capture.empty()) {
			if (engine.capture->grab())
				engine.capture->retrieve(drawing_frame,
						CV_CAP_ANDROID_COLOR_FRAME_RGBA);

			cv::cvtColor(drawing_frame, drawing_frame, cv::COLOR_RGBA2RGB);
//			cv::cvtColor(drawing_frame, drawing_frame, cv::COLOR_RGB2HSV);
//
//			cv::split(drawing_frame, hsv);
//
//			cv::threshold(hsv[2], thresholded, 40, 255, cv::THRESH_BINARY);
//
//			cv::cvtColor(thresholded, drawing_frame, cv::COLOR_GRAY2RGB);

			char buffer[256];
			sprintf(buffer, "Display performance: %dx%d @ %.3f",
					drawing_frame.cols, drawing_frame.rows, fps);
			cv::putText(drawing_frame, std::string(buffer), cv::Point(8, 20),
					cv::FONT_HERSHEY_COMPLEX_SMALL, 1, textColor);

//			cv::cvtColor(drawing_frame, drawing_frame, cv::COLOR_RGBA2RGB);
			cv::cvtColor(drawing_frame, drawing_frame, cv::COLOR_RGB2RGBA);
			engine_draw_frame(&engine, drawing_frame);
		}

		if (time_queue.size() >= 2)
			then = time_queue.front();
		else
			then = 0;

		if (time_queue.size() >= 25)
			time_queue.pop();

		fps = time_queue.size() * (float) cv::getTickFrequency() / (now - then);
	}
}
