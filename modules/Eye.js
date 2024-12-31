import Globals from "./Globals.js";

export default class Eye {
    #lastThree = [0, 0, 0];
    #eyePosition = vec3.fromValues(6.5, 7.5, -1.5);
    #lightPosition = vec3.fromValues(6.5, 15, 4.5);
    #lookAtPoint = vec3.fromValues(6.5, 0, 1.5);
    #lookUpVector = vec3.fromValues(0.0, 0.0, 1.0);

    /**
     * Uses a sigmoid function to ease eye movement based on the user's  movement.
     * @returns The increment to move the eye and lookat point along the z-axis
     */
    getEyeSpeed() {
        // Get the distance from where the eye should be centered
        let dist = this.#eyePosition[2] - Globals.modelCenters[Globals.frog.index][2] + 2;
        if (dist == 0)
            return 0; // No need to calculate if we're already centered

        // Calculate 0.25 * e^x / (10+e^x)
        // Offset to ensure f(0) = 0
        let ex = Math.exp(Math.abs(dist));
        let speed = (ex / (10 + ex) - 0.09090909090909091) / 4;

        // Return with the correct sign
        return (dist < 0) ? speed : -speed;
    }

    /**
     * Updates the position of the eye.
     */
    updatePosition() {
        // Move the eye and lookat point with the player
        // Get the difference between the last frame's position and the expected position in the
        // next frame and move the view scalar amount in that direction
        this.#lastThree[2] = this.#lastThree[1];
        this.#lastThree[1] = this.#lastThree[0];
        this.#lastThree[0] = this.getEyeSpeed(); // Update the buffer of the last 3 speeds and average them
        vec3.set(Globals.frog.direction, 0, 0, (this.#lastThree[0] + this.#lastThree[1] + this.#lastThree[2]) / 3);
        mat4.fromTranslation(Globals.translate, Globals.frog.direction);
        vec3.transformMat4(this.#eyePosition, this.#eyePosition, Globals.translate);
        vec3.transformMat4(this.#lookAtPoint, this.#lookAtPoint, Globals.translate);

        // Set up the view and perspective matrices
        // These will be the same for each triangle set
        // The lookAt matrix will follow the frog
        mat4.lookAt(Globals.viewMatrix, this.#eyePosition, this.#lookAtPoint, this.#lookUpVector);
        mat4.perspective(Globals.projectionMatrix, Math.PI/3, Globals.aspectRatio, 1, 50);
        Globals.gl.uniformMatrix4fv(Globals.viewMatrixUniform, false, Globals.viewMatrix);
        Globals.gl.uniformMatrix4fv(Globals.projectionMatrixUniform, false, Globals.projectionMatrix);

        // Eye and light positions
        Globals.gl.uniform3fv(Globals.eyePositionUniform, this.#eyePosition);
        Globals.gl.uniform3fv(Globals.lightPositionUniform, this.#lightPosition);
    }

    /**
     * Resets the eye position.
     */
    resetPosition() {
        this.#lastThree = [0, 0, 0];
        vec3.set(this.#eyePosition, 6.5, 7.5, -1.5);
        vec3.set(this.#lookAtPoint, 6.5, 0, 1.5);
    }
}