var nameInput = document.getElementById("a");
var addressInput = document.getElementById("b");
var reasonInput = document.getElementById("c");
var resultBox = document.getElementById("x");

let randomThing = 22;

document.body.style.cursor = "default";

function enterPressed(x){
    return x.key == "Enter";
}

nameInput.addEventListener("keydown", function(t){

    if(enterPressed(t)){

        if(nameInput.value.trim() != ""){

            addressInput.disabled = false;
            addressInput.focus();
            nameInput.style.background = "lightyellow";

        }
    }
});

addressInput.addEventListener("keydown", function(y){

    if(enterPressed(y)){

        if(addressInput.value.length > 2){

            reasonInput.disabled = false;
            reasonInput.focus();
            addressInput.style.border = "5px solid green";

        }
    }
});

function makeMessage(userReason){

    var thing = "";

    if(userReason.toLowerCase().includes("job")){

        thing = "A.I. coding could help you switch careers faster than learning everything the traditional way.";

    } else if(userReason.toLowerCase().includes("game")){

        thing = "You seem creative. A.I. tools are great for helping beginners build games quickly.";

    } else if(userReason.toLowerCase().includes("money")){

        thing = "A lot of people are using A.I. coding tools to create side projects and online businesses.";

    } else {

        thing = "Learning coding with A.I. is becoming one of the fastest ways for non-programmers to build ideas.";

    }

    return thing;
}

function changeBackground(){

    document.body.style.background =
        "rgb(" +
        (Math.random() * 255) + "," +
        (Math.random() * 255) + "," +
        (Math.random() * 255) +
        ")";
}

function showResult(personName, fakeAddress, userReason, thing){

    resultBox.innerHTML =
        "<h2>Hello " + personName + "</h2>" +
        "<p>We saved your address as:</p>" +
        "<p><b>" + fakeAddress + "</b></p>" +
        "<p>You said:</p>" +
        "<p><i>" + userReason + "</i></p>" +
        "<hr>" +
        "<p>" + thing + "</p>" +
        "<p>Your application number is " + randomThing + "</p>";
}

reasonInput.addEventListener("keydown", function(p){

    if(enterPressed(p)){

        if(reasonInput.value != ""){

            resultBox.innerHTML = "";

            var personName = nameInput.value;
            var fakeAddress = addressInput.value;
            var userReason = reasonInput.value;

            var thing = makeMessage(userReason);

            randomThing = randomThing + 1;

            showResult(personName, fakeAddress, userReason, thing);
            changeBackground();

        }
    }
});
