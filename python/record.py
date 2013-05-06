# simple video recorder, for making a test video of the globe
# used both for the paper and for people without my specific globe.
import cv2
import numpy as np
import random
from video import create_capture
from common import clock, draw_str

cam = create_capture(0)
cv2.namedWindow('camera')

recorder = cv2.VideoWriter(filename="vid.mpg", fps=30, frameSize=(640, 480),
                           fourcc=cv2.cv.FOURCC('F', 'M', 'P', '4'))
while True:
  ret, img = cam.read()
  recorder.write(img)
  cv2.imshow('camera', img)
  if 0xFF & cv2.waitKey(5) == 27:
    break

cam.release()
cv2.destroyAllWindows()
