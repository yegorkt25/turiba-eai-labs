"""
Aggregator Service
==================
Demonstrates the AGGREGATOR pattern:
- Collects results from multiple workers (orders.results queue)
- Uses count-based completion strategy (wait for N items)
- Produces final order status when all items are processed

Consumes from: orders.results
Publishes to: orders.complete
"""

import json
import pika
import os
from collections import defaultdict
import threading


# In-memory storage for aggregation
# NOTE: In production, use Redis or a database for persistence across restarts
order_results = defaultdict(list)
order_expected = {}
lock = threading.Lock()


def get_rabbitmq_connection():
    """Create a connection to RabbitMQ using environment variable for host."""
    return pika.BlockingConnection(
        pika.ConnectionParameters(host=os.environ.get('RABBITMQ_HOST', 'localhost'))
    )


def aggregate_result(ch, method, properties, body):
    """
    Aggregate a result from a worker:
    1. Store the result
    2. Check if all items for the order are complete
    3. If complete, publish final status to orders.complete
    """
    result = json.loads(body)
    order_id = result['orderId']
    total_items = result['totalItems']
    
    with lock:
        order_results[order_id].append(result)
        order_expected[order_id] = total_items
        
        current_count = len(order_results[order_id])
        print(f"[Aggregator] Received result {current_count}/{total_items} for order {order_id}")
        
        # AGGREGATOR PATTERN: Count-based completion condition
        if current_count >= total_items:
            complete_order(order_id)
    
    # Acknowledge the message
    ch.basic_ack(delivery_tag=method.delivery_tag)


def complete_order(order_id):
    """
    Complete an order by publishing the aggregated results.
    Called when all items have been processed.
    """
    results = order_results[order_id]
    
    # Build final status message
    final_status = {
        'orderId': order_id,
        'status': 'complete',
        'totalItems': len(results),
        'itemResults': results
    }
    
    # Publish to orders.complete
    connection = get_rabbitmq_connection()
    channel = connection.channel()
    
    channel.queue_declare(queue='orders.complete', durable=True)
    
    channel.basic_publish(
        exchange='',
        routing_key='orders.complete',
        body=json.dumps(final_status),
        properties=pika.BasicProperties(delivery_mode=2)  # Persistent
    )
    
    connection.close()
    
    print(f"[Aggregator] Order {order_id} COMPLETE - all {len(results)} items processed")
    
    # Cleanup in-memory storage
    del order_results[order_id]
    del order_expected[order_id]


def main():
    """Main entry point: connect to RabbitMQ and start consuming results."""
    connection = get_rabbitmq_connection()
    channel = connection.channel()
    
    # Declare queues (idempotent)
    channel.queue_declare(queue='orders.results', durable=True)
    channel.queue_declare(queue='orders.complete', durable=True)
    
    # Fair dispatch
    channel.basic_qos(prefetch_count=1)
    
    # Start consuming
    channel.basic_consume(queue='orders.results', on_message_callback=aggregate_result)
    
    print('[Aggregator] Waiting for results...')
    channel.start_consuming()


if __name__ == '__main__':
    main()
