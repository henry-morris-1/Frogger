import Globals from "./Globals.js";
import Model from "./Model.js";

export default class Frog extends Model {
    #index;                                     // Index of the user frog in the model array
    #direction = vec3.create();                 // Direction the frog is facing
    #target = vec3.fromValues(6.5, 0.25, 0.5);  // Target position to move the player to
    #facing = "up";                             // Orientation of the user model, changes to match directional input
    #tension = 0.1;                             // Force moving the player toward the target
    #friction = 0.625;                          // Force dampening player movement
    #springForce = vec3.create();               // Force from tension
    #frictionForce = vec3.create();             // Force from friction
    #acceleration = vec3.create();              // Acceleration due to the above forces
    #velocity = vec3.create();                  // Player velocity
    #precision = 0.001;                         // Precision cutoff for ending movement
    #drift = vec3.create();                     // Drift induced by being on a log or turtle

    /**
     * Constructs a frog with the given transformations.
     * @param {String} type Frog type, hero or dummy
     */
    constructor(type) {
        // Load the model
        super("../models/frog.json", "../textures/frog.png");

        // Set the model index
        this.#index = Globals.modelSetCount - 1;

        // Set the user model index
        switch (type) {
            case "hero":
                this.heroTransform();
                break;
            case "dummy":
                this.dummyTransform();
                break;
        }
    }

    /**
     * Gets the index of this model in the buffers.
     * @returns Index of this model in the buffers
     */
    get index() {
        return this.#index;
    }

    /**
     * Gets the Vec3 of this model's direction.
     * @returns Vec3 of this model's direction
     */
    get direction() {
        return this.#direction;
    }

    /**
     * Gets the bounding x and z values for the player model.
     * @returns Minium and maximum x and z positions of the model
     */
    get bounds() {
        let center = Globals.modelCenters[this.#index];

        return {
            xMin: center[0] - 0.25,
            xMax: center[0] + 0.25,
            zMin: center[2] - 0.25,
            zMax: center[2] + 0.25
        };
    }

    /**
     * Transforms the user model frog to the starting position.
     */
    heroTransform() {
        // Center
        mat4.fromTranslation(Globals.translate, vec3.negate(vec3.create(), Globals.modelCenters[this.#index]));
        mat4.multiply(Globals.modelMatrices[this.#index], Globals.translate, Globals.modelMatrices[this.#index]);
        vec3.transformMat4(Globals.modelCenters[this.#index], Globals.modelCenters[this.#index], Globals.translate);
        // Scale
        mat4.fromScaling(Globals.scale, vec3.fromValues(0.055, 0.055, 0.055));
        mat4.multiply(Globals.modelMatrices[this.#index], Globals.scale, Globals.modelMatrices[this.#index]);
        // Place
        vec3.set(this.#direction, 6.5, 0.25, 0.5);
        mat4.fromTranslation(Globals.translate, this.#direction);
        mat4.multiply(Globals.modelMatrices[this.#index], Globals.translate, Globals.modelMatrices[this.#index]);
        vec3.transformMat4(Globals.modelCenters[this.#index], Globals.modelCenters[this.#index], Globals.translate);
    }

    /**
     * Transforms a dummy frog out of bounds for later use.
     */
    dummyTransform() {
        // Center
        mat4.fromTranslation(Globals.translate, vec3.negate(vec3.create(), Globals.modelCenters[this.#index]));
        mat4.multiply(Globals.modelMatrices[this.#index], Globals.translate, Globals.modelMatrices[this.#index]);
        vec3.transformMat4(Globals.modelCenters[this.#index], Globals.modelCenters[this.#index], Globals.translate);
        // Scale
        mat4.fromScaling(Globals.scale, vec3.fromValues(0.055, 0.055, 0.055));
        mat4.multiply(Globals.modelMatrices[this.#index], Globals.scale, Globals.modelMatrices[this.#index]);
        // Send out of bounds for recall later
        vec3.set(this.#direction, 6.5, 0, -10);
        mat4.fromTranslation(Globals.translate, this.#direction);
        mat4.multiply(Globals.modelMatrices[this.#index], Globals.translate, Globals.modelMatrices[this.#index]);
        vec3.transformMat4(Globals.modelCenters[this.#index], Globals.modelCenters[this.#index], Globals.translate);
    }

    /**
     * Calculates the directed velocity of the user for based on their  current position, 
     * current velocity, and distance to the target position. Uses spring calculations
     * to move the model to the target with tension and a friction force acting against it.
     * @return velocity vector for the player
     */
    getPlayerSpeedAndDirection(deltaTime) {
        // Get the direction to the target
        vec3.set(this.#direction, this.#target[0] - Globals.modelCenters[this.#index][0], 0, this.#target[2] - Globals.modelCenters[this.#index][2]);

        // If the distance to move is below the precision threshold, return zeros
        if (vec3.length(this.#direction) < this.#precision)
            return vec3.create();

        // Calculate the spring force toward the target and the friction force against it
        vec3.scale(this.#springForce, this.#direction, this.#tension);
        vec3.scale(this.#frictionForce, this.#velocity, -this.#friction);

        // Calculate the acceleration based on the forces and the new velocity from the
        // acceleration
        vec3.add(this.#acceleration, this.#springForce, this.#frictionForce);
        vec3.add(this.#velocity, this.#velocity, this.#acceleration);

        // Scale based on the deltaTime
        vec3.scale(this.#velocity, this.#velocity, 0.06 * deltaTime);

        // Return velocity
        return this.#velocity;
    }

    /**
     * Updates the position of the player model.
     */
    updatePosition(deltaTime) {
        vec3.scale(this.#drift, this.#drift, deltaTime); // Scale the drift
        mat4.fromTranslation(Globals.translate, this.#drift); // Get the translation matrix
        vec3.transformMat4(this.#target, this.#target, Globals.translate); // Translate the target

        // Player movement
        mat4.fromTranslation(Globals.translate, this.getPlayerSpeedAndDirection(deltaTime)); // Get the appropriate translation matrix
        mat4.multiply(Globals.modelMatrices[this.#index], Globals.translate, Globals.modelMatrices[this.#index]); // Translate model matrix
        vec3.transformMat4(Globals.modelCenters[this.#index], Globals.modelCenters[this.#index], Globals.translate); // Translate center
    }

    /**
     * Resets the frog's position and facing to the original location.
     */
    resetPosition() {
        // Move the user back to the start
        vec3.set(this.#direction, 6.5 - Globals.modelCenters[this.#index][0], 0, 0.5 - Globals.modelCenters[this.#index][2]);
        mat4.fromTranslation(Globals.translate, this.#direction);
        mat4.multiply(Globals.modelMatrices[this.#index], Globals.translate, Globals.modelMatrices[this.#index]);
        vec3.set(Globals.modelCenters[this.#index], 6.5, 0.25, 0.5);
        vec3.set(this.#target, 6.5, 0.25, 0.5);
        vec3.set(this.#velocity, 0, 0, 0);

        // Re-orient the user to face forward
        if (this.#facing !== "up") {
            // Center
            mat4.fromTranslation(Globals.translate, vec3.negate(vec3.create(), Globals.modelCenters[this.#index]));
            mat4.multiply(Globals.modelMatrices[this.#index], Globals.translate, Globals.modelMatrices[this.#index]);

            // Rotate
            if (!Globals.timeout && this.#facing === "down")
                mat4.fromRotation(Globals.rotate, Math.PI, vec3.fromValues(0, 1, 0));
            else if (this.#facing === "left")
                mat4.fromRotation(Globals.rotate, -Math.PI / 2, vec3.fromValues(0, 1, 0));
            else if (this.#facing === "right")
                mat4.fromRotation(Globals.rotate, Math.PI / 2, vec3.fromValues(0, 1, 0));
            mat4.multiply(Globals.modelMatrices[this.#index], Globals.rotate, Globals.modelMatrices[this.#index]);

            // Move back
            mat4.fromTranslation(Globals.translate, Globals.modelCenters[this.#index]);
            mat4.multiply(Globals.modelMatrices[this.#index], Globals.translate, Globals.modelMatrices[this.#index]);

            this.#facing = "up"; // Set the facing
        }
    }

    /**
     * Resets the frog after a score.
     */
    scoreReset() {
        // Set the a timeout for 1.5 sec
        Globals.timeout = true;
        window.setTimeout(() => { Globals.timeout = false }, 1500);

        // Move a spare frog into the home
        mat4.copy(Globals.modelMatrices[Globals.modelSetCount - (Globals.homeCount + 1)], Globals.modelMatrices[this.#index]);
        vec3.copy(Globals.modelCenters[Globals.modelSetCount - (Globals.homeCount + 1)], Globals.modelCenters[this.#index]);

        // Reset the position
        this.resetPosition();
    }

    /**
     * Resets the frog after a death.
     */
    deathReset() {
        // Take a timeout to freeze the program on the frame where the user died
        // The user will be translated back to the start point in this function so
        // they remain in place while frozen
        if (Globals.lives > 0) {
            Globals.freeze = true;
            setTimeout(() => {
                this.resetPosition(); // Reset position
                Globals.freeze = false; // Reset the flag
            }, 1000);

            // Take a timeout to prevent unwanted movement
            Globals.timeout = true;
            setTimeout(() => { Globals.timeout = false }, 1500);
        }
    }

    /**
     * Checks if the user has scored to increment the home count and reset the game.
     */
    checkScore() {
        // Check if the current position is past the threshold to score
        if (Globals.modelCenters[this.#index][2] > 12.499) {
            Globals.homeCount++; // Increment the home count

            document.getElementById("score").innerHTML = `Lily Pads: ${Globals.homeCount}`; // Update scoreboard

            (Globals.homeCount < 5) && this.scoreReset();
        }
    }

    /**
     * Checks if the player has a collision with a car.
     * @param {Number} currRow Current z position of the player model
     * @returns true if the player is in contact with a car
     */
    checkCarCollision(currRow) {
        // Get the bounding box of the player model
        let playerBounds = this.bounds;

        // Loop over each car
        for (const car of Globals.cars) {
            if (Math.abs(currRow - car.row <= 0.5)) {
                // Get the bounding box of the car
                let carBounds = car.bounds;

                // Get the edge check booleans
                let left = playerBounds.xMin < carBounds.xMax;
                let right = playerBounds.xMax > carBounds.xMin;
                let top = playerBounds.zMax > carBounds.zMin;
                let bottom = playerBounds.zMin < carBounds.zMax;

                // Return true if there is a collision
                if (left && right && top && bottom) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Checks if the player model hits a boundary while on a log/turtle.
     * @returns true if the player hits a boundary
     */
    checkBoundaryCollision() {
        // Get the bounding box of the player model
        let playerBounds = this.bounds;

        // Check if the player has hit an edge on the log
        return (playerBounds.xMin <= 0 || playerBounds.xMax >= 13);
    }

    /**
     * Checks if the player has a collision with a log.
     * @param {Number} currRow Current z position of the player model
     * @returns true if the player is not in contact with a log
     */
    checkLogCollision(currRow) {
        // Get the bounding box of the player model
        let playerBounds = this.bounds;

        // Loop over each log
        for (const log of Globals.logs) {
            if (Math.abs(currRow - log.row <= 0.5)) {
                // Get the bounding box of the log
                let logBounds = log.bounds;

                // Get the edge check booleans
                let left = playerBounds.xMin < logBounds.xMax;
                let right = playerBounds.xMax > logBounds.xMin;
                let top = playerBounds.zMax > logBounds.zMin;
                let bottom = playerBounds.zMin < logBounds.zMax;

                // Return false if there is a collision
                if (left && right && top && bottom) {
                    // Set the drift to the motion of the log
                    let sign = 2 * (Math.floor(logBounds.zMin) % 2) - 1; // Get the +/- sign for the drift direction
                    vec3.set(this.#drift, sign * 0.0021, 0, 0);

                    return false;
                }
            }
        }

        // Set drift back to zero and return true
        vec3.set(this.#drift, 0, 0, 0);
        return true;
    }

    /**
     * Checks if the player has a collision with a turtle.
     * @param {Number} currRow Current z position of the player model
     * @returns true if the player is not in contact with a turtle
     */
    checkTurtleCollision(currRow) {
        // Get the bounding box of the player model
        let playerBounds = this.bounds;

        // Loop over each turtle
        for (const turtle of Globals.turtles) {
            if (Math.abs(currRow - turtle.row <= 0.5)) {
                // Get the bounding box of the turtle
                let turtleBounds = turtle.bounds;

                // Get the edge check booleans
                let left = playerBounds.xMin < turtleBounds.xMax;
                let right = playerBounds.xMax > turtleBounds.xMin;
                let top = playerBounds.zMax > turtleBounds.zMin;
                let bottom = playerBounds.zMin < turtleBounds.zMax;

                // Return false if there is a collision and the turtle is above water
                if (turtle.aboveWater && left && right && top && bottom) {
                    // Set the drift to the motion of the log
                    let sign = 2 * (Math.floor(turtleBounds.zMin) % 2) - 1; // Get the +/- sign for the drift direction
                    vec3.set(this.#drift, sign * 0.001707, 0, 0);

                    return false;
                }
            }
        }
        
        // Set drift back to zero and return true
        vec3.set(this.#drift, 0, 0, 0);
        return true;
    }

    /**
     * Checks collisions between the player and obstacles.
     * @returns true if the player should lose a life
     */
    checkCollision() {
        // Get the current z position of the frog
        let currRow = Globals.modelCenters[this.#index][2];

        // Find which obstacles might be in the way to check collisions
        if (currRow > 0.75 && currRow < 6.25) {
            vec3.set(this.#drift, 0, 0, 0);
            return this.checkCarCollision(currRow);

        } else if (currRow > 7 && currRow < 12) {
            return this.checkBoundaryCollision() || (this.checkLogCollision(currRow) && this.checkTurtleCollision(currRow));

        } else {
            vec3.set(this.#drift, 0, 0, 0);
            return false;
        }
    }

    /**
     * Moves the player model forward one row.
     */
    moveForward() {
        // Determine whether to move forward
        if (this.#target[2] < 11.5) {
            // Always forward if the frog isn't trying to go into a home/the last row
            vec3.set(this.#target, this.#target[0], 0.25, this.#target[2] + 1);

        } else if (this.#target[2] == 11.5) {
            // Only move into the homes if they're empty
            // Players don't have to be exactly lined up, but make sure they get put in the middle of the lily pad
            if (Globals.modelCenters[this.#index][0] > 2.25 && Globals.modelCenters[this.#index][0] < 2.75 && !Globals.home[0]) {
                Globals.home[0] = true;
                vec3.set(this.#target, 2.5, 0.25, 12.5);
            } else if (Globals.modelCenters[this.#index][0] > 4.25 && Globals.modelCenters[this.#index][0] < 4.75 && !Globals.home[1]) {
                Globals.home[1] = true;
                vec3.set(this.#target, 4.5, 0.25, 12.5);
            } else if (Globals.modelCenters[this.#index][0] > 6.25 && Globals.modelCenters[this.#index][0] < 6.75 && !Globals.home[2]) {
                Globals.home[2] = true;
                vec3.set(this.#target, 6.5, 0.25, 12.5);
            } else if (Globals.modelCenters[this.#index][0] > 8.25 && Globals.modelCenters[this.#index][0] < 8.75 && !Globals.home[3]) {
                Globals.home[3] = true;
                vec3.set(this.#target, 8.5, 0.25, 12.5);
            } else if (Globals.modelCenters[this.#index][0] > 10.25 && Globals.modelCenters[this.#index][0] < 10.75 && !Globals.home[4]) {
                Globals.home[4] = true;
                vec3.set(this.#target, 10.5, 0.25, 12.5);
            }
        }

        // Orient the frog to match the input
        if (this.#facing !== "up") {
            // Center
            mat4.fromTranslation(Globals.translate, vec3.negate(vec3.create(), Globals.modelCenters[this.#index]));
            mat4.multiply(Globals.modelMatrices[this.#index], Globals.translate, Globals.modelMatrices[this.#index]);

            // Rotate
            if (this.#facing == "down")
                mat4.fromRotation(Globals.rotate, Math.PI, vec3.fromValues(0, 1, 0));
            else if (this.#facing == "left")
                mat4.fromRotation(Globals.rotate, -Math.PI / 2, vec3.fromValues(0, 1, 0));
            else if (this.#facing == "right")
                mat4.fromRotation(Globals.rotate, Math.PI / 2, vec3.fromValues(0, 1, 0));
            mat4.multiply(Globals.modelMatrices[this.#index], Globals.rotate, Globals.modelMatrices[this.#index]);

            // Move back
            mat4.fromTranslation(Globals.translate, Globals.modelCenters[this.#index]);
            mat4.multiply(Globals.modelMatrices[this.#index], Globals.translate, Globals.modelMatrices[this.#index]);

            this.#facing = "up"; // Set the facing
        }
    }

    /**
     * Moves the player model left one column.
     */
    moveLeft() {
        // Move left if it is within the surface
        if (this.#target[0] < 12.5 && this.#target[2] < 12.5) {
            vec3.set(this.#target, this.#target[0] + 1, 0.25, this.#target[2]);
        }

        // Orient the frog to match the input
        if (this.#facing !== "left") {
            // Center
            mat4.fromTranslation(Globals.translate, vec3.negate(vec3.create(), Globals.modelCenters[this.#index]));
            mat4.multiply(Globals.modelMatrices[this.#index], Globals.translate, Globals.modelMatrices[this.#index]);

            // Rotate
            if (this.#facing === "up")
                mat4.fromRotation(Globals.rotate, Math.PI / 2, vec3.fromValues(0, 1, 0));
            else if (this.#facing === "down")
                mat4.fromRotation(Globals.rotate, -Math.PI / 2, vec3.fromValues(0, 1, 0));
            else if (this.#facing === "right")
                mat4.fromRotation(Globals.rotate, Math.PI, vec3.fromValues(0, 1, 0));
            mat4.multiply(Globals.modelMatrices[this.#index], Globals.rotate, Globals.modelMatrices[this.#index]);

            // Move back
            mat4.fromTranslation(Globals.translate, Globals.modelCenters[this.#index]);
            mat4.multiply(Globals.modelMatrices[this.#index], Globals.translate, Globals.modelMatrices[this.#index]);

            this.#facing = "left"; // Set the facing
        }
    }

    /**
     * Moves the player model down one row.
     */
    moveDown() {
        // Move down if it is within the surface
        if (this.#target[2] > 0.5 && this.#target[2] < 12.5) {
            vec3.set(this.#target, this.#target[0], 0.25, this.#target[2] - 1);
        }

        // Orient the frog to match the input
        if (this.#facing !== "down") {
            // Center
            mat4.fromTranslation(Globals.translate, vec3.negate(vec3.create(), Globals.modelCenters[this.#index]));
            mat4.multiply(Globals.modelMatrices[this.#index], Globals.translate, Globals.modelMatrices[this.#index]);

            // Rotate
            if (this.#facing === "up")
                mat4.fromRotation(Globals.rotate, Math.PI, vec3.fromValues(0, 1, 0));
            else if (this.#facing === "left")
                mat4.fromRotation(Globals.rotate, Math.PI / 2, vec3.fromValues(0, 1, 0));
            else if (this.#facing === "right")
                mat4.fromRotation(Globals.rotate, -Math.PI / 2, vec3.fromValues(0, 1, 0));
            mat4.multiply(Globals.modelMatrices[this.#index], Globals.rotate, Globals.modelMatrices[this.#index]);

            // Move back
            mat4.fromTranslation(Globals.translate, Globals.modelCenters[this.#index]);
            mat4.multiply(Globals.modelMatrices[this.#index], Globals.translate, Globals.modelMatrices[this.#index]);

            this.#facing = "down"; // Set the facing
        }
    }

    /**
     * Moves the player model right one column.
     */
    moveRight() {
        // Move right if it is within the surface
        if (this.#target[0] > 0.5 && this.#target[2] < 12.5) {
            vec3.set(this.#target, this.#target[0] - 1, 0.25, this.#target[2]);
        }

        // Orient the frog to match the input
        if (this.#facing !== "right") {
            // Center
            mat4.fromTranslation(Globals.translate, vec3.negate(vec3.create(), Globals.modelCenters[this.#index]));
            mat4.multiply(Globals.modelMatrices[this.#index], Globals.translate, Globals.modelMatrices[this.#index]);

            // Rotate
            if (this.#facing === "up")
                mat4.fromRotation(Globals.rotate, -Math.PI / 2, vec3.fromValues(0, 1, 0));
            else if (this.#facing === "down")
                mat4.fromRotation(Globals.rotate, Math.PI / 2, vec3.fromValues(0, 1, 0));
            else if (this.#facing === "left")
                mat4.fromRotation(Globals.rotate, Math.PI, vec3.fromValues(0, 1, 0));
            mat4.multiply(Globals.modelMatrices[this.#index], Globals.rotate, Globals.modelMatrices[this.#index]);

            // Move back
            mat4.fromTranslation(Globals.translate, Globals.modelCenters[this.#index]);
            mat4.multiply(Globals.modelMatrices[this.#index], Globals.translate, Globals.modelMatrices[this.#index]);

            this.#facing = "right"; // Set the facing
        }
    }
}