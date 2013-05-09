# Geoid, webgl edition

Geoid is a visualization of global ocean currents from the [ECCO2][1] dataset, using a the method described in [Animation of Orthogonal Texture-based Vector Field Visualization (2007), by Sven Bachthaler and Daniel Weiskopf][0], with some simplifications. Geoid is implemented in WebGL and Javascript (through [coco][2]).

## Motivation

Geoid is Steven Ruppert's final project for **CSCI 547 Scientific Visualization**, at the Colorado School of Mines, Spring 2013, taught by Andrzej Szymczak.

The project was inspired by [Fernanda Viégas and Martin Wattenberg's animated US Wind map][3], and [Nicolas Garcia Belmonte's work with animated vector field visualization and WebGL][4].

## Technique

A basic sphere is textured with a visualization of the ocean surface current vector field (and satelilte imagery of land from [Blue Marble Next Generation][5)]. Textures are mapped to the sphere in longitude/latitude space. The visualization texture is generated every frame using the following technique:

1. Create random noise texture using a pseudo-random number generator.
2. Convolve the noise texture using the Line Integral Convolution (LIC) technique and the vector field _orthogonal_ to the ocean current field. The orthogonal field is generated from the real field using the mapping `orthogonal(x, y) = [-original(x, y).y, original(x, y).x]`.
3. Advect the previous visualization texture along the original vector field by following the streamline from the current position backwards and assigning the new pixel value to the pixel value found at the end of the streamline.
4. Blend the noise LIC texture with the advected texture using a user-specified ratio, i.e. `new_pixel = advected * (1 - ratio) + LIC * ratio`
5. Display the blended texture on the globe, and save the blended texture for the next frame in step 3. The display on the globe is accompanied by 3 post-processing steps:
  * Velocity Masking: Areas of the field with low magnitude are blacked out according the formula in section 4.10.2 of [Lagrangian-eulerian advection of noise and dye textures for unsteady flow visualization (2002), by Bruno Jobard, Gordon Erlebacher, and M. Yousuff Hussaini][6].
  * Contrast Stretching: the final blended texture's value variance is reduced by the averaging effect of LIC and advection, so the final texture's contrast is enhanced by stretching a value range around 0.5 (e.g. 0.4-0.6) back to the range 0.0-1.0.
  * Coloration: since the visualization is of the ocean, a slight blue coloration is added to the original greyscale texture.

## Implementation

Both LIC and texture advection lend themselves well to parallelization on the GPU, using Euler's method in a fragment shader. Each step described is implemented as a separate WebGL/OpenGL ES 2.0 shader program, with some supporting JS/coco code. All steps except the globe display render to a WebGL RGBA texture, which is passed into the next step's fragment shader. All the GLSL source code is in the file `programs.co`.

To save the step of generating a new noise texture every frame, only a single noise texture is generated, and a random offset to the texture lookup coordinates is used to randomize every frame.

The ECCO2 ocean current dataset is provided as 32-bit floating point values, but due to the lack of linear interpolation for floating point textures as well as the memory requirements for storing many timeslices of the data in graphics memory, the original dataset was resized to 1024x512 8-bit textures, using the red and green channels for the two components of one timeslice and the blue and alpha channels for another timeslice. 8 of these packed textures are additionally packed into a 2048x2048 compressed PNG image. This technique reduced 240 timeslices of the dataset originally 1.8 GB total to 94 MB. For the level of detail present in this project, even the reduced precision generates acceptable results. 

The dataset can be downloaded and packed using the shell and GNU Octave scripts in the `octave` directory of this repository, but this isn't necessary to run the application, as `geoid.co` currently points to an already-processed version of the dataset hosted on Amazon S3.

Most of the tunable parameters in the algorithm are exposed to the user as sliders, which control uniform variables in the shader programs.

While the original paper only uses the orthogonal LIC texture due to its more easily human-detectable motion, geoid also includes the option to use a traditional LIC texture, which--in the author's opinion--looks nicer, despite its less easily detectable motion.

The main animation loop and supporting Javascript/coco for the slider variables and mouse rotation/zooming are in the file `geoid.co`. Browser support for the sliders and mouse wheel events are polyfilled in the two other javascript files.

## Results

Geoid should run in modern web browsers with support for OpenGL, which, at the time of writing, the most popular are Mozilla Firefox and Google Chrome[ium]. Open `index.html`, or browse to the hosted version at:

http://blendmaster.github.io/geoid

to run the application. Additional explanation of the tunable parameters is available on the 'about' section of the page.

### Screenshots

TODO

## Discussion

### Limitations

While interesting to play with, the large amount of user parameters is not ideal for visualization techniques, the best of which "just work" for a given input vector field.

While the lossy compression of the current dataset doesn't result in too much loss of precision, some artifacts are still visible due to the limited precision, most notably the limited levels of pixel values which create sharp color bands after contrast stretching. Using a floating-point grayscale texture as a transport between shaders would increase the quality of the visualization after contrast stretching.

Geoid does not implement temporally-coherent noise transport as described in section 3.3 of [bachthaler's paper][0]. Doing so would not take too much work, however, as lookups into the ocean dataset are temporally linearly interpolated between time slices.

The temporal linear interpolation of the dataset (monthly averages) does create some spurious effects, such as these stretched-out circular flows off the coast of Africa:

TODO image

Using the 3-day average timeslices from ECCO2 dataset would reduce these artifacts.

### Future Work:

The ECCO2 dataset includes other variables, such as temperature and salinity. Those values could be shown though a color mapping.

The ECCO2 dataset also includes 49 other depth slices and a Z vector component for the current data. With some clever compression or optimization, these could be incorporated into the visualization, perhaps using a volume rendering technique on 3D LIC.

## License

All original code and content in this repository is released to the public domain--or as close as legally possible--under the terms of the [Unlicense][7].

[0]: http://www.vis.uni-stuttgart.de/~weiskopf/publications/eurovis07.pdf
[1]: http://ecco2.jpl.nasa.gov/
[2]: https://github.com/satyr/coco
[3]: http://hint.fm/wind/
[4]: http://philogb.github.io/blog/2012/08/14/playing-with-line-integral-convolutions/
[5]: http://visibleearth.nasa.gov/view_cat.php?categoryID=1484
[6]: http://www.cs.ucdavis.edu/~ma/ECS276/readings/Jobard_TVCG02.pdf
[7]: http://unlicense.org
