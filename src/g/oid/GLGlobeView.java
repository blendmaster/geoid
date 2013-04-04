package g.oid;

import android.content.Context;
import android.opengl.GLSurfaceView;
import android.util.AttributeSet;

/**
 * OpenGL ES2.0 view for augmented reality overlay.
 */
public class GLGlobeView extends GLSurfaceView {

	public GLGlobeView(Context context, AttributeSet attrs) {
		super(context, attrs);
		setEGLContextClientVersion(2);
		setRenderer(new GLGlobeRenderer());
		setRenderMode(GLSurfaceView.RENDERMODE_WHEN_DIRTY);
	}

}
