# geoid.py

`geoid.py` connects to either a camera attached to your computer or a video file, such as `test.ogv`, and attempts to augment a globe with a virtual overlay.

You'll need OpenCV 2.5.4 and Python 2.7.2 installed.

Run:

    python geoid.py -h

To list options.

To run against the training images and test video included in this repository, run:

    python geoid.py ../training/cropped -v test.ogv

## record.py

`record.py` captures webcam frames and records them to `output.mpg`.

## train.py

`train.py` will save an image from the camera called `train-{n}.jpg` every time the spacebar is pressed.
