# snap training data pictures
import cv2
import numpy as np
import random
from video import create_capture
from common import clock, draw_str

cam = create_capture(0)

cv2.namedWindow('camera')

n = 0
while True:
  ret, img = cam.read()
  t = clock()

  vis = img

  dt = clock() - t

  draw_str(vis, (20, 20), 'time: %.1f ms' % (dt*1000))

  cv2.imshow('camera', vis)

  key = 0xFF & cv2.waitKey(5)
  if key == 27:
    break
  if key == 32: # space
    # save image
    cv2.imwrite("train-%i.jpg" % n, img)
    print("image saved..")
    n = n + 1

cam.release()
cv2.destroyAllWindows()

