function translate_purchase_event(event) {
    let client_id = event.app_user_id;
    let product_id = event.type == "PRODUCT_CHANGE" ? event.new_product_id : event.product_id;
    let item_term = product_id.search("1m") >= 0 ? "ONE MONTH" : "ONE YEAR";
    let ga4 = {
        "client_id": client_id,
        "non_personalized_ads" : false,
        "events" : [
            {
                "name": "purchase",
                "params": {
                    "items": [
                        {
                            "item_id": product_id,
                            "item_name": event.type,
                            "quantity": 1,
                            "affiliation": event.store,
                            "coupon": "NONE",
                            "discount": 0,
                            "item_brand": "K9 Karaoke",
                            "item_category": "subscription",
                            "item_variant": item_term,
                            "tax": 0,
                            "price": event.price,
                            "currency": event.currency
                        }
                    ],
                    "affiliation": event.store,
                    "coupon": "NONE",
                    "currency": event.currency,
                    "transaction_id": event.transaction_id,
                    "shipping" : 0,
                    "tax" : 0,
                    "value": event.price
                }
            }
        ]
    };
    console.log("attempting to translate", event.type, "by", client_id, "for", product_id);
    //console.log(JSON.stringify(ga4));
    return ga4;
}

function translate_transfer_event(event) {
    console.log("Skipping transfer event for now.");
}


function translate_event(event, client_id) {
    var translated_event = null;
    try {
        console.log("event_type:", event.type);
        //console.log(JSON.stringify(event));
        if(event.type == "TRANSFER") {
            translate_transfer_event(event);
        }
        else {
            translated_event = translate_purchase_event(event, client_id);
        }
    }
    catch (err) {
        console.log("Error parsing JSON string:", err);
    }
    return translated_event;
}

function test_rcat() {
    console.log("............... rcat2ga4 says hello!")
}


exports.translate_event = translate_event;
exports.test_rcat = test_rcat;
