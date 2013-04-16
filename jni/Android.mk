LOCAL_PATH := $(call my-dir)

include $(CLEAR_VARS)

include /home/steven/lib/OpenCV-2.4.5-android-sdk/sdk/native/jni/OpenCV.mk

LOCAL_MODULE    := geoid
LOCAL_SRC_FILES := geoid.cpp
LOCAL_LDLIBS    += -lm -llog -landroid
LOCAL_STATIC_LIBRARIES := android_native_app_glue

include $(BUILD_SHARED_LIBRARY)

$(call import-module,android/native_app_glue)
