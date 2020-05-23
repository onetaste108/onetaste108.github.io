IplImage *GPUOpticalFlowEstimator::computeOpticalFlow(GPUImagePyramid *frame1_pyr, GPUImagePyramid *frame2_pyr) {

    for(int i=m_params.numLevels-1; i>=0; i--) { //we need to propogate uv through the pyramid

        m_framebuffers[i]->bind();

        int w = frame1_pyr->impyramid()->pyramid()[i]->width;
        int h = frame1_pyr->impyramid()->pyramid()[i]->height;

        pOpticalFlowShaderProgram = m_shaders[i];

        {   //set up the correct camera viewpoint
            glViewport(0,0,w,h);
            glMatrixMode(GL_PROJECTION);
            glLoadIdentity();
            glOrtho(0,w,h,0.f,-1.f,1.f);
            glMatrixMode(GL_MODELVIEW);
            glLoadIdentity();
        }

        {  // render uv to target 1

            GLenum buffers[] = { GL_COLOR_ATTACHMENT1_EXT };
            glDrawBuffers(1, buffers);

            pOpticalFlowShaderProgram->bind();

            glActiveTexture(GL_TEXTURE0);
            glBindTexture(GL_TEXTURE_2D, frame1_pyr->Ix()[i]);
            pOpticalFlowShaderProgram->setUniformValue("Ix1", 0);

            glActiveTexture(GL_TEXTURE1);
            glBindTexture(GL_TEXTURE_2D, frame1_pyr->Iy()[i]);
            pOpticalFlowShaderProgram->setUniformValue("Iy1", 1);

            glActiveTexture(GL_TEXTURE2);
            glBindTexture(GL_TEXTURE_2D, frame1_pyr->I()[i]);
            pOpticalFlowShaderProgram->setUniformValue("I1", 2);

            glActiveTexture(GL_TEXTURE3);
            glBindTexture(GL_TEXTURE_2D, frame2_pyr->I()[i]);
            pOpticalFlowShaderProgram->setUniformValue("I2", 3);

            if(i!=m_params.numLevels-1) {
                glActiveTexture(GL_TEXTURE4);
                glBindTexture(GL_TEXTURE_2D, m_framebuffers[i+1]->texture()[1]);
                pOpticalFlowShaderProgram->setUniformValue("uv", 4);
            }

            glActiveTexture(GL_TEXTURE0);
            pOpticalFlowShaderProgram->setUniformValue("texWidth", (float)w);
            pOpticalFlowShaderProgram->setUniformValue("texHeight", (float)h);
            DRAW_GLQUAD
            pOpticalFlowShaderProgram->release();

        }
        m_framebuffers[i]->release();
    }


    m_framebuffers[0]->bind();
    int w = m_framebuffers[0]->width();
    int h = m_framebuffers[0]->height();

    { //median filter
        GLenum buffers[] = { GL_COLOR_ATTACHMENT0_EXT };
        glDrawBuffers(1, buffers);
        pMedianShaderProgram->bind();
        glActiveTexture(GL_TEXTURE0);
        glBindTexture(GL_TEXTURE_2D, m_framebuffers[0]->color_attachments()[1]);
        pMedianShaderProgram->setUniformValue("src", 0);
        pMedianShaderProgram->setUniformValue("invWidth", 1.f / w);
        pMedianShaderProgram->setUniformValue("invHeight", 1.f / h);
        DRAW_GLQUAD
        pMedianShaderProgram->release();

    }

    m_framebuffers[0]->release();

    glBindTexture(GL_TEXTURE_2D, m_framebuffers[0]->color_attachments()[1]);
    glGetTexImage(GL_TEXTURE_2D, 0, GL_RGBA, GL_FLOAT, (float *)m_data->imageData);
    glBindTexture(GL_TEXTURE_2D, 0);

    return m_data;
}
		