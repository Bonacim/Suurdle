function flash(channel, message) {
    const alertClass = channel === "error" ? "danger" : "sucess";
    let alert = $("#alertBox").children(`.alert-${alertClass}`);
    if (alert.length === 0) {
        const element = `<div class="alert alert-danger" role="alert">${message}</div>`;
        if (channel === "error" ) {
            $("#alertBox").prepend(element);
        } else {
            $("#alertBox").append(element);
        }
    } else {
        alert.text(message);
    }
}

function ajaxError(jqXHR, exception) {
    if (jqXHR.status === 0) {
        flash("error","Not connect.\n Verify Network.");
    } else if (jqXHR.status == 404) {
        flash("error","Requested page not found. [404]");
    } else if (jqXHR.status == 500) {
        flash("error","Internal Server Error [500].");
    } else if (exception === "parsererror") {
        flash("error","Requested JSON parse failed.");
    } else if (exception === "timeout") {
        flash("error","Time out error.");
    } else if (exception === "abort") {
        flash("error","Ajax request aborted.");
    } else {
        flash("error","Uncaught Error.\n" + jqXHR.responseText);
    }
}

function ajaxSuccess(data,viewSelector) {
    if (data.redirect) {
        window.location.href = data.redirect;
    } else {
        if (data.error || data.success) {
            if (data.error) {
                flash("error", data.error);
            }
            if (data.success) {
                flash("success", data.success);
            }
        } else {
            $(viewSelector).html(data);
        }
    }
}

            