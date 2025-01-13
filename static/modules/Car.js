import Globals from "./Globals.js";
import Model from "./Model.js";

export default class Car extends Model {
    #index;                      // Index of the car model
    #lane;                       // Lane in which this car drives
    #direction = vec3.create();  // Direction vector
    #explosionSteps = 15;        // Number of frames for an explosion

    /**
     * Constructs a car with a random color in the given lane
     * @param {Number} lane Lane in which to place the car
     * @param {Number} offset Number car in the given lane
     */
    constructor(lane, offset) {
        // Randomly assign a color
        let color, r = Math.random();
        if (r < 0.25)       color = "red";
        else if (r < 0.5)   color = "blue";
        else if (r < 0.75)  color = "green";
        else                color = "yellow";

        // Add the model
        super("../models/car.json", `../textures/car_${color}.png`);

        // Set the model index and lane
        this.#index = Globals.modelSetCount - 1;
        this.#lane = lane;

        // Transform the car
        this.transform(lane, offset);
    }

    /**
     * Gets the model index of the car.
     * @returns model index of the car
     */
    get index() {
        return this.#index;
    }

    /**
     * Gets the row the car is in as a z-position.
     * @returns y position of the car
     */
    get row() {
        return Globals.modelCenters[this.#index][2];
    }

    /**
     * Gets the bounding x and z values for the car.
     * @returns Minium and maximum x and z positions of the model
     */
    get bounds() {
        let center = Globals.modelCenters[this.#index];

        return {
            xMin: center[0] - 0.75,
            xMax: center[0] + 0.75,
            zMin: center[2] - 0.31773,
            zMax: center[2] + 0.31773
        };
    }

    /**
     * Transforms the car model into the given lane.
     * @param {Number} lane Lane in which to place the car
     * @param {Number} offset Number car in the given lane
     */
    transform(lane, offset) {
        // Translate to center for uniform scaling/rotations
        Globals.modelCenters[this.#index] = vec3.fromValues(0, 1.4, 0); // Manually set the center
        mat4.fromTranslation(Globals.translate, vec3.negate(vec3.create(), Globals.modelCenters[this.#index]));
        mat4.multiply(Globals.modelMatrices[this.#index], Globals.translate, Globals.modelMatrices[this.#index]);
        vec3.transformMat4(Globals.modelCenters[this.#index], Globals.modelCenters[this.#index], Globals.translate);

        // Rotate cars in the first, third, and fifth lanes since they drive the other direction
        if (lane % 2 === 1) {
            mat4.fromRotation(Globals.rotate, Math.PI, vec3.fromValues(0,1,0));
            mat4.multiply(Globals.modelMatrices[this.#index], Globals.rotate, Globals.modelMatrices[this.#index]);
        }

        // Scale to fit the lanes
        mat4.fromScaling(Globals.scale, vec3.fromValues(0.25, 0.25, 0.25));
        mat4.multiply(Globals.modelMatrices[this.#index], Globals.scale, Globals.modelMatrices[this.#index]);

        // Translate back to the "starting location"
        mat4.fromTranslation(Globals.translate, vec3.fromValues(13.5, 0.35, 1.5));
        mat4.multiply(Globals.modelMatrices[this.#index], Globals.translate, Globals.modelMatrices[this.#index]);
        vec3.transformMat4(Globals.modelCenters[this.#index], Globals.modelCenters[this.#index], Globals.translate);

        // Place the cars in each lane, using the offset to space them within their lane
        // Start by getting a translation vector based on the lane the car is in
        switch (lane) {
            case 1:
                vec3.set(this.#direction, offset * -3.667, 0, 0);
                break;
            case 2:
                vec3.set(this.#direction, offset * -5, 0, 1);
                break;
            case 3:
                vec3.set(this.#direction, offset * -2, 0, 2);
                break;
            case 4:
                vec3.set(this.#direction, offset * -6.667, 0, 3);
                break;
            case 5:
                vec3.set(this.#direction, offset * -3, 0, 4);
                break;
        }

        mat4.fromTranslation(Globals.translate, this.#direction); // Get the appropriate translation matrix
        mat4.multiply(Globals.modelMatrices[this.#index], Globals.translate, Globals.modelMatrices[this.#index]); // Translate model matrix
        vec3.transformMat4(Globals.modelCenters[this.#index], Globals.modelCenters[this.#index], Globals.translate); // Translate center
    }

    /**
     * Updates the position of the car.
     * @param {Number} deltaTime Number of ms since the last frame
     */
    updatePosition(deltaTime) {
        // Get the direction vector based on the lane and whether it has reached the edge yet
        switch (this.#lane) {
            case 1:
                (Globals.modelCenters[this.#index][0] < -0.5) ? vec3.set(this.#direction, 14, 0, 0) : vec3.set(this.#direction, -0.0015 * deltaTime, 0, 0);
                break;
            case 2:
                (Globals.modelCenters[this.#index][0] > 13.5) ? vec3.set(this.#direction, -14, 0, 0) : vec3.set(this.#direction, 0.003 * deltaTime, 0, 0);
                break;
            case 3:
                (Globals.modelCenters[this.#index][0] < -0.5) ? vec3.set(this.#direction, 14, 0, 0) : vec3.set(this.#direction, -0.009 * deltaTime, 0, 0);
                break;
            case 4:
                (Globals.modelCenters[this.#index][0] > 13.5) ? vec3.set(this.#direction, -14, 0, 0) : vec3.set(this.#direction, 0.0045 * deltaTime, 0, 0);
                break;
            case 5:
                (Globals.modelCenters[this.#index][0] < -0.5) ? vec3.set(this.#direction, 14, 0, 0) : vec3.set(this.#direction, -0.0015 * deltaTime, 0, 0);
                break;
        }

        mat4.fromTranslation(Globals.translate, this.#direction); // Get the appropriate translation matrix
        mat4.multiply(Globals.modelMatrices[this.#index], Globals.translate, Globals.modelMatrices[this.#index]); // Translate model matrix
        vec3.transformMat4(Globals.modelCenters[this.#index], Globals.modelCenters[this.#index], Globals.translate); // Translate center
    }

    /**
     * Explodes a car out of the gameplay environment.
     * @param {Vec3} velocity Veclocity vector to follow
     * @param {Number} step Animation step
     */
    explode(velocity, step) {
        // Set the acceleration due to gravity
        let gravity = vec3.fromValues(0, -0.2, 0);

        // Add the acceleration to the velocity
        vec3.add(velocity, velocity, gravity);

        // Translate the car a step
        mat4.fromTranslation(Globals.translate, velocity);
        mat4.multiply(Globals.modelMatrices[this.#index], Globals.translate, Globals.modelMatrices[this.#index]);
        vec3.transformMat4(Globals.modelCenters[this.#index], Globals.modelCenters[this.#index], Globals.translate);

        // Request the next explosion frame
        if (step < this.#explosionSteps)
            requestAnimationFrame(() => { this.explode(velocity, step + 1); });
        else {
            // When done, move out of bounds
            vec3.set(velocity, 6.5 - Globals.modelCenters[this.#index][0], 0, -10 - Globals.modelCenters[this.#index][2]);
            mat4.fromTranslation(Globals.translate, velocity);
            mat4.multiply(Globals.modelMatrices[this.#index], Globals.translate, Globals.modelMatrices[this.#index]);
            vec3.transformMat4(Globals.modelCenters[this.#index], Globals.modelCenters[this.#index], Globals.translate);
        }
    }
}