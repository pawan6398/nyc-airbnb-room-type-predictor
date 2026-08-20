const API_URL = "http://127.0.0.1:8000/predict";


// ======================================================
// GET ELEMENTS
// ======================================================

const form = document.getElementById("listing-form");

const submitBtn = document.getElementById("submit-btn");

const formError = document.getElementById("form-error");

const panelEmpty = document.getElementById("result-empty");

const panelLoading = document.getElementById("result-loading");

const panelDone = document.getElementById("result-done");

const panelError = document.getElementById("result-error");

const errorText = document.getElementById("result-error-text");

const stamp = document.getElementById("stamp");

const stampText = document.getElementById("stamp-text");

const confidenceValue =
    document.getElementById("confidence-value");

const confidenceFill =
    document.getElementById("confidence-fill");

const probList =
    document.getElementById("prob-list");


// ======================================================
// MODEL CLASS NAMES
// ======================================================

const CLASS_NAMES = [
    "Entire home/apt",
    "Private room",
    "Shared room"
];


// ======================================================
// FIELD TYPES
// ======================================================

const NUMERIC_FIELDS = new Set([
    "latitude",
    "longitude",
    "price",
    "minimum_nights",
    "number_of_reviews",
    "reviews_per_month",
    "calculated_host_listings_count",
    "availability_365"
]);


const INT_FIELDS = new Set([
    "minimum_nights",
    "number_of_reviews",
    "calculated_host_listings_count",
    "availability_365"
]);


// ======================================================
// PANEL CONTROL
// ======================================================

function showPanel(which) {

    panelEmpty.hidden =
        which !== "empty";

    panelLoading.hidden =
        which !== "loading";

    panelDone.hidden =
        which !== "done";

    panelError.hidden =
        which !== "error";
}


// ======================================================
// BUTTON STATE
// ======================================================

function setSubmitting(isSubmitting) {

    submitBtn.disabled = isSubmitting;

    submitBtn.classList.toggle(
        "is-loading",
        isSubmitting
    );

    const label =
        submitBtn.querySelector(
            ".submit-btn__label"
        );

    if (label) {

        label.textContent =
            isSubmitting
                ? "Reading the file..."
                : "Classify listing";
    }
}


// ======================================================
// ERROR
// ======================================================

function clearFormError() {

    formError.hidden = true;

    formError.textContent = "";
}


function showFormError(message) {

    formError.textContent = message;

    formError.hidden = false;
}


// ======================================================
// LABEL
// ======================================================

function labelFor(fieldName) {

    const label =
        form.querySelector(
            `label[for="${fieldName}"]`
        );

    if (label) {

        return label.textContent
            .replace("*", "")
            .trim();
    }

    return fieldName;
}


// ======================================================
// BUILD PAYLOAD
// ======================================================

function buildPayload() {

    const data =
        new FormData(form);

    const payload = {};

    for (const [key, rawValue] of data.entries()) {

        if (NUMERIC_FIELDS.has(key)) {

            const value =
                INT_FIELDS.has(key)
                    ? parseInt(rawValue, 10)
                    : parseFloat(rawValue);

            if (Number.isNaN(value)) {

                throw new Error(
                    `"${labelFor(key)}" must be a valid number.`
                );
            }

            payload[key] = value;

        } else {

            payload[key] =
                String(rawValue).trim();
        }
    }

    return payload;
}


// ======================================================
// VALIDATION ERROR FROM FASTAPI
// ======================================================

function friendlyValidationMessage(detail) {

    if (
        !Array.isArray(detail) ||
        detail.length === 0
    ) {

        return "The server rejected the submitted values.";
    }

    const first = detail[0];

    const field =
        Array.isArray(first.loc)
            ? first.loc[first.loc.length - 1]
            : "field";

    return `${labelFor(field)}: ${first.msg}`;
}


// ======================================================
// RENDER RESULT
// ======================================================

function renderResult(result) {

    console.log("API RESULT:", result);


    const roomType =
        result.Predicted_room_type ?? "Unknown";


    const probabilities =
        Array.isArray(result.Probability)
            ? result.Probability
            : [];


    // ----------------------------------------------
    // ROOM TYPE
    // ----------------------------------------------

    stampText.textContent =
        roomType;


    // ----------------------------------------------
    // CONFIDENCE
    // ----------------------------------------------

    if (probabilities.length > 0) {

        const maxProbability =
            Math.max(...probabilities);


        const confidence =
            Math.round(
                maxProbability * 1000
            ) / 10;


        confidenceValue.textContent =
            `${confidence}%`;


        confidenceFill.style.width =
            "0%";


        requestAnimationFrame(() => {

            confidenceFill.style.width =
                `${confidence}%`;

        });


        // ------------------------------------------
        // PROBABILITY LIST
        // ------------------------------------------

        probList.innerHTML = "";


        probabilities.forEach(
            (probability, index) => {

                const li =
                    document.createElement("li");


                const className =
                    CLASS_NAMES[index]
                    ?? `Class ${index}`;


                const percentage =
                    Math.round(
                        probability * 1000
                    ) / 10;


                li.innerHTML = `
                    <span>${className}</span>
                    <span>${percentage}%</span>
                `;


                probList.appendChild(li);

            }
        );

    } else {

        confidenceValue.textContent =
            "—";

        confidenceFill.style.width =
            "0%";

        probList.innerHTML = "";
    }


    // ----------------------------------------------
    // SHOW RESULT
    // ----------------------------------------------

    showPanel("done");


    // Replay stamp animation

    stamp.classList.remove(
        "is-stamped"
    );

    void stamp.offsetWidth;

    stamp.classList.add(
        "is-stamped"
    );
}


// ======================================================
// FORM SUBMIT
// ======================================================

form.addEventListener(
    "submit",
    async function(event) {

        event.preventDefault();


        clearFormError();


        // ------------------------------------------
        // HTML VALIDATION
        // ------------------------------------------

        if (!form.checkValidity()) {

            form.reportValidity();

            return;
        }


        // ------------------------------------------
        // BUILD PAYLOAD
        // ------------------------------------------

        let payload;


        try {

            payload =
                buildPayload();

        } catch (error) {

            showFormError(
                error.message
            );

            return;
        }


        console.log(
            "Sending payload:",
            payload
        );


        // ------------------------------------------
        // LOADING
        // ------------------------------------------

        setSubmitting(true);

        showPanel("loading");


        try {

            // --------------------------------------
            // API REQUEST
            // --------------------------------------

            const response =
                await fetch(
                    API_URL,
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json",

                            "Accept":
                                "application/json"
                        },

                        body:
                            JSON.stringify(payload)
                    }
                );


            console.log(
                "HTTP status:",
                response.status
            );


            // --------------------------------------
            // ERROR RESPONSE
            // --------------------------------------

            if (!response.ok) {

                let message =
                    `Request failed with status ${response.status}.`;


                try {

                    const body =
                        await response.json();


                    if (
                        response.status === 422 &&
                        body.detail
                    ) {

                        message =
                            friendlyValidationMessage(
                                body.detail
                            );

                    } else if (
                        body.detail
                    ) {

                        message =
                            typeof body.detail === "string"
                                ? body.detail
                                : message;
                    }

                } catch (_) {

                    // Ignore invalid JSON
                }


                throw new Error(message);
            }


            // --------------------------------------
            // JSON RESPONSE
            // --------------------------------------

            const result =
                await response.json();


            console.log(
                "Prediction:",
                result
            );


            // --------------------------------------
            // RENDER
            // --------------------------------------

            renderResult(result);


        } catch (error) {

            console.error(
                "Prediction error:",
                error
            );


            const isNetworkError =
                error instanceof TypeError;


            errorText.textContent =
                isNetworkError

                    ? `Couldn't reach the API at ${API_URL}. Make sure FastAPI is running.`

                    : error.message;


            showPanel("error");


        } finally {

            setSubmitting(false);

        }

    }
);